/**
 * Device JWT verifier for WaveX OS local <-> cloud-console pairing.
 *
 * The console (wavexcard.com/os) mints HS256 JWTs after a user pairs a
 * local device via the `os-link-device` / `os-claim-device` /
 * `os-device-token` edge-function chain. Local services (Liaison,
 * Paperclip-side proxies, the future `os-spend-intent` caller) verify
 * those tokens with THIS module before honoring any device-scoped
 * request.
 *
 * Both sides MUST share the same `WAVEX_DEVICE_JWT_SECRET` value. Place
 * it in `~/.wavex-os/state/.env`; never commit it. The auth-shim
 * deliberately depends only on `node:crypto` so this validator can be
 * imported from any local service (inference-server, mock-core,
 * op-omega-server, future spend-intent proxy) without dragging a heavy
 * JWT library transitively into all of them.
 *
 * Claim shape minted by the cloud side (as documented by the
 * wavex-experience-architect team 2026-05-13):
 *
 *   {
 *     aud: "os-device",          // hard-required; rejects mis-purposed tokens
 *     sub: <user_id (uuid)>,     // Supabase auth.users.id
 *     device_id: <uuid>,         // os_devices.id row
 *     scope: "os_device",        // current scope; future tiers may add more
 *     iat: <unix seconds>,
 *     exp: <unix seconds — 1h TTL from cloud side>
 *   }
 *
 * Tokens are validated with constant-time signature compare to defeat
 * timing oracles; payload claims are then range-checked.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const SECRET = process.env.WAVEX_DEVICE_JWT_SECRET ?? "";

const EXPECTED_AUD = "os-device";
const EXPECTED_SCOPE = "os_device";

export interface DeviceJwtPayload {
  aud: typeof EXPECTED_AUD;
  sub: string;
  device_id: string;
  scope: string;
  iat: number;
  exp: number;
}

function base64UrlDecode(s: string): Buffer {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 ? 4 - (s.length % 4) : 0;
  return Buffer.from(s + "=".repeat(pad), "base64");
}

function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export interface VerifyResult {
  ok: boolean;
  payload?: DeviceJwtPayload;
  reason?:
    | "no_secret"
    | "malformed"
    | "bad_header"
    | "bad_signature"
    | "expired"
    | "wrong_aud"
    | "wrong_scope"
    | "bad_payload";
}

/**
 * Verify a HS256 device JWT.
 *
 * Returns `{ ok: true, payload }` on success; `{ ok: false, reason }`
 * on every failure so callers can log the failure class without
 * mishandling the payload-is-optional case.
 *
 * The function NEVER throws on bad input — every malformed token is a
 * `{ ok: false }` result. This matches the rest of the auth-shim's
 * "soft-fail + caller-decides" posture.
 */
export function verifyDeviceJwt(token: string | undefined): VerifyResult {
  if (!SECRET) return { ok: false, reason: "no_secret" };
  if (!token || typeof token !== "string") return { ok: false, reason: "malformed" };

  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };

  const [headerB64, payloadB64, sigB64] = parts;
  if (!headerB64 || !payloadB64 || !sigB64) return { ok: false, reason: "malformed" };

  // Header must declare HS256. We don't accept "alg":"none" or anything else
  // — that's a 2015-era JWT footgun and we'd rather hard-reject.
  let header: { alg?: string; typ?: string };
  try {
    header = JSON.parse(base64UrlDecode(headerB64).toString("utf8"));
  } catch {
    return { ok: false, reason: "bad_header" };
  }
  if (header?.alg !== "HS256") return { ok: false, reason: "bad_header" };

  // Constant-time signature compare.
  const expectedSig = base64UrlEncode(
    createHmac("sha256", SECRET)
      .update(`${headerB64}.${payloadB64}`)
      .digest(),
  );
  const sigBuf = Buffer.from(sigB64);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length) return { ok: false, reason: "bad_signature" };
  if (!timingSafeEqual(sigBuf, expBuf)) return { ok: false, reason: "bad_signature" };

  // Payload shape + range checks.
  let payload: DeviceJwtPayload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64).toString("utf8")) as DeviceJwtPayload;
  } catch {
    return { ok: false, reason: "bad_payload" };
  }
  if (typeof payload?.sub !== "string" || !payload.sub) return { ok: false, reason: "bad_payload" };
  if (typeof payload?.device_id !== "string" || !payload.device_id) return { ok: false, reason: "bad_payload" };
  if (typeof payload?.iat !== "number") return { ok: false, reason: "bad_payload" };
  if (typeof payload?.exp !== "number") return { ok: false, reason: "bad_payload" };

  if (payload.aud !== EXPECTED_AUD) return { ok: false, reason: "wrong_aud", payload };
  if (payload.scope !== EXPECTED_SCOPE) return { ok: false, reason: "wrong_scope", payload };

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) return { ok: false, reason: "expired", payload };

  return { ok: true, payload };
}

/**
 * For unit tests + local smoke. NOT exported from the package's public
 * surface — callers should never need to mint device tokens locally
 * (that's the cloud side's job).
 *
 * @internal
 */
export function _signDeviceJwt_TEST_ONLY(
  payload: Omit<DeviceJwtPayload, "aud" | "scope" | "iat"> & {
    iat?: number;
  },
): string {
  if (!SECRET) throw new Error("WAVEX_DEVICE_JWT_SECRET not set");
  const header = { alg: "HS256", typ: "JWT" };
  const full: DeviceJwtPayload = {
    aud: EXPECTED_AUD,
    scope: EXPECTED_SCOPE,
    sub: payload.sub,
    device_id: payload.device_id,
    iat: payload.iat ?? Math.floor(Date.now() / 1000),
    exp: payload.exp,
  };
  const h = base64UrlEncode(Buffer.from(JSON.stringify(header)));
  const p = base64UrlEncode(Buffer.from(JSON.stringify(full)));
  const sig = base64UrlEncode(createHmac("sha256", SECRET).update(`${h}.${p}`).digest());
  return `${h}.${p}.${sig}`;
}
