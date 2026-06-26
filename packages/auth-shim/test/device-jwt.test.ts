import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import {
  verifyDeviceJwt,
  _signDeviceJwt_TEST_ONLY,
} from "../src/device-jwt.js";

const ORIGINAL_ENV = { ...process.env };
const SECRET = "test-device-secret";

beforeEach(() => {
  process.env.WAVEX_DEVICE_JWT_SECRET = SECRET;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

// craft a token with arbitrary header + payload, signed with SECRET unless told
// otherwise. the public signer forces aud/scope, so we need this to reach the
// wrong_aud / wrong_scope / bad_header branches.
function craft(
  payload: Record<string, unknown>,
  opts: { alg?: string; secret?: string } = {},
): string {
  const header = { alg: opts.alg ?? "HS256", typ: "JWT" };
  const h = b64url(Buffer.from(JSON.stringify(header)));
  const p = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(
    createHmac("sha256", opts.secret ?? SECRET).update(`${h}.${p}`).digest(),
  );
  return `${h}.${p}.${sig}`;
}

const future = () => Math.floor(Date.now() / 1000) + 3600;
const past = () => Math.floor(Date.now() / 1000) - 60;

describe("verifyDeviceJwt", () => {
  it("accepts a fresh, well-formed token", () => {
    const token = _signDeviceJwt_TEST_ONLY({
      sub: "user-1",
      device_id: "dev-1",
      exp: future(),
    });
    const res = verifyDeviceJwt(token);
    expect(res.ok).toBe(true);
    expect(res.payload?.sub).toBe("user-1");
    expect(res.payload?.device_id).toBe("dev-1");
    expect(res.reason).toBeUndefined();
  });

  it("accepts the authenticated aud minted by the deployed edge fn", () => {
    const token = craft({
      aud: "authenticated",
      scope: "os_device",
      sub: "u",
      device_id: "d",
      iat: future() - 3600,
      exp: future(),
    });
    expect(verifyDeviceJwt(token).ok).toBe(true);
  });

  it("reports no_secret when the env var is missing", () => {
    const token = _signDeviceJwt_TEST_ONLY({
      sub: "u",
      device_id: "d",
      exp: future(),
    });
    delete process.env.WAVEX_DEVICE_JWT_SECRET;
    expect(verifyDeviceJwt(token)).toEqual({ ok: false, reason: "no_secret" });
  });

  it("rejects undefined / empty / wrong-shaped tokens as malformed", () => {
    expect(verifyDeviceJwt(undefined).reason).toBe("malformed");
    expect(verifyDeviceJwt("").reason).toBe("malformed");
    expect(verifyDeviceJwt("a.b").reason).toBe("malformed");
    expect(verifyDeviceJwt("..").reason).toBe("malformed");
  });

  it("rejects alg none and non-HS256 headers", () => {
    const none = craft(
      { aud: "os-device", scope: "os_device", sub: "u", device_id: "d", iat: 1, exp: future() },
      { alg: "none" },
    );
    expect(verifyDeviceJwt(none).reason).toBe("bad_header");

    const rs256 = craft(
      { aud: "os-device", scope: "os_device", sub: "u", device_id: "d", iat: 1, exp: future() },
      { alg: "RS256" },
    );
    expect(verifyDeviceJwt(rs256).reason).toBe("bad_header");
  });

  it("rejects a token signed with the wrong secret", () => {
    const token = craft(
      { aud: "os-device", scope: "os_device", sub: "u", device_id: "d", iat: 1, exp: future() },
      { secret: "not-the-secret" },
    );
    expect(verifyDeviceJwt(token).reason).toBe("bad_signature");
  });

  it("rejects a tampered payload", () => {
    const token = _signDeviceJwt_TEST_ONLY({
      sub: "u",
      device_id: "d",
      exp: future(),
    });
    const parts = token.split(".");
    const tampered = b64url(
      Buffer.from(JSON.stringify({ aud: "os-device", scope: "os_device", sub: "evil", device_id: "d", iat: 1, exp: future() })),
    );
    expect(verifyDeviceJwt(`${parts[0]}.${tampered}.${parts[2]}`).reason).toBe("bad_signature");
  });

  it("rejects an expired token but still returns the payload", () => {
    const token = _signDeviceJwt_TEST_ONLY({
      sub: "u",
      device_id: "d",
      iat: past() - 60,
      exp: past(),
    });
    const res = verifyDeviceJwt(token);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("expired");
    expect(res.payload?.sub).toBe("u");
  });

  it("rejects a wrong audience", () => {
    const token = craft({
      aud: "some-other-app",
      scope: "os_device",
      sub: "u",
      device_id: "d",
      iat: 1,
      exp: future(),
    });
    expect(verifyDeviceJwt(token).reason).toBe("wrong_aud");
  });

  it("rejects a wrong scope", () => {
    const token = craft({
      aud: "os-device",
      scope: "not_os_device",
      sub: "u",
      device_id: "d",
      iat: 1,
      exp: future(),
    });
    expect(verifyDeviceJwt(token).reason).toBe("wrong_scope");
  });

  it("rejects payloads missing required claims", () => {
    const noSub = craft({ aud: "os-device", scope: "os_device", device_id: "d", iat: 1, exp: future() });
    expect(verifyDeviceJwt(noSub).reason).toBe("bad_payload");

    const noDevice = craft({ aud: "os-device", scope: "os_device", sub: "u", iat: 1, exp: future() });
    expect(verifyDeviceJwt(noDevice).reason).toBe("bad_payload");

    const noExp = craft({ aud: "os-device", scope: "os_device", sub: "u", device_id: "d", iat: 1 });
    expect(verifyDeviceJwt(noExp).reason).toBe("bad_payload");
  });

  it("rejects a payload that is not valid json", () => {
    const h = b64url(Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })));
    const p = b64url(Buffer.from("not json"));
    const sig = b64url(createHmac("sha256", SECRET).update(`${h}.${p}`).digest());
    expect(verifyDeviceJwt(`${h}.${p}.${sig}`).reason).toBe("bad_payload");
  });
});
