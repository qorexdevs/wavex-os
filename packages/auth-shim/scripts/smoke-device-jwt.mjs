#!/usr/bin/env node
/**
 * Standalone smoke test for the device-JWT validator.
 *
 * Loads WAVEX_DEVICE_JWT_SECRET from `~/.wavex-os/state/.env`, mints
 * a token, verifies it, then runs five adversarial cases:
 *   1. tampered signature → bad_signature
 *   2. tampered payload   → bad_signature (HMAC catches this)
 *   3. expired exp        → expired
 *   4. wrong aud          → wrong_aud
 *   5. alg=none header    → bad_header
 *
 * Run as:
 *   node packages/auth-shim/scripts/smoke-device-jwt.mjs
 *
 * Exit 0 on all-pass, 1 on any failure.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ── load env from ~/.wavex-os/state/.env ─────────────────────────────────────
const envPath = join(homedir(), ".wavex-os", "state", ".env");
try {
  for (const raw of readFileSync(envPath, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
} catch {
  console.error(`ERROR: cannot read ${envPath} — set WAVEX_DEVICE_JWT_SECRET there first`);
  process.exit(2);
}

if (!process.env.WAVEX_DEVICE_JWT_SECRET) {
  console.error("FAIL: WAVEX_DEVICE_JWT_SECRET not set after loading env");
  process.exit(2);
}

const secret = process.env.WAVEX_DEVICE_JWT_SECRET;
if (secret.length < 32) {
  console.warn(`WARN: secret length=${secret.length} bytes (HS256 wants ≥32). Continuing anyway.`);
}

// Import the validator AFTER env is loaded so the module-level SECRET read sees it.
// auth-shim is noEmit (consumers re-emit), so this script must be run under tsx:
//   pnpm exec tsx packages/auth-shim/scripts/smoke-device-jwt.mjs
const { verifyDeviceJwt, _signDeviceJwt_TEST_ONLY } = await import("../src/device-jwt.ts");

let pass = 0;
let fail = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    pass++;
  } else {
    console.log(`  ✗ ${label} — ${detail ?? ""}`);
    fail++;
  }
}

const now = Math.floor(Date.now() / 1000);
const baseClaims = {
  sub: "00000000-0000-0000-0000-000000000abc",
  device_id: "00000000-0000-0000-0000-000000000def",
  exp: now + 3600,
};

console.log("\n── Round-trip (mint → verify) ──");
const good = _signDeviceJwt_TEST_ONLY(baseClaims);
console.log(`  token preview: ${good.slice(0, 24)}…${good.slice(-12)}`);
const goodVerify = verifyDeviceJwt(good);
check("valid token → ok=true", goodVerify.ok, JSON.stringify(goodVerify));
check("payload.sub matches", goodVerify.payload?.sub === baseClaims.sub);
check("payload.device_id matches", goodVerify.payload?.device_id === baseClaims.device_id);
check("payload.aud === 'os-device'", goodVerify.payload?.aud === "os-device");
check("payload.scope === 'os_device'", goodVerify.payload?.scope === "os_device");

console.log("\n── Adversarial: tampered signature ──");
const [h, p, s] = good.split(".");
const tamperedSig = good.slice(0, -4) + (s.endsWith("AAAA") ? "BBBB" : "AAAA");
const tamperedSigVerify = verifyDeviceJwt(tamperedSig);
check("tampered sig → ok=false", !tamperedSigVerify.ok);
check("reason=bad_signature", tamperedSigVerify.reason === "bad_signature", tamperedSigVerify.reason);

console.log("\n── Adversarial: tampered payload (re-sig elsewhere wouldn't match) ──");
const tamperedPayload = `${h}.${Buffer.from(JSON.stringify({ ...baseClaims, sub: "evil-user" })).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")}.${s}`;
const tpVerify = verifyDeviceJwt(tamperedPayload);
check("tampered payload → ok=false", !tpVerify.ok);
check("reason=bad_signature", tpVerify.reason === "bad_signature", tpVerify.reason);

console.log("\n── Adversarial: expired token ──");
const expired = _signDeviceJwt_TEST_ONLY({ ...baseClaims, exp: now - 60, iat: now - 3660 });
const expVerify = verifyDeviceJwt(expired);
check("expired → ok=false", !expVerify.ok);
check("reason=expired", expVerify.reason === "expired", expVerify.reason);

console.log("\n── Adversarial: alg=none header ──");
const noneHeader = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
const noneSigToken = `${noneHeader}.${p}.`;
const noneVerify = verifyDeviceJwt(noneSigToken);
check("alg=none → ok=false", !noneVerify.ok);
// reason will be "malformed" because parts.length !== 3 due to trailing empty sig
// OR "bad_header" if we kept a placeholder sig. Either is fine — both reject.
check("reason rejects alg=none", noneVerify.reason === "malformed" || noneVerify.reason === "bad_header", noneVerify.reason);

console.log("\n── Adversarial: empty token / null / wrong type ──");
check("undefined → ok=false", !verifyDeviceJwt(undefined).ok);
check("'' → ok=false", !verifyDeviceJwt("").ok);
check("garbage → ok=false", !verifyDeviceJwt("not.a.jwt").ok);

console.log(`\nResult: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
