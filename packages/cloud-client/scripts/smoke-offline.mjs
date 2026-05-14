#!/usr/bin/env node
/**
 * Offline smoke for @wavex-os/cloud-client.
 *
 * Exercises every code path that doesn't require hitting the live cloud:
 *   - config defaults
 *   - token-store CRUD (read/write/delete with chmod 600)
 *   - getValidAccessToken throws no_paired_device when bundle missing
 *   - getValidAccessToken returns access_token when expiry > 60s
 *   - introspect on a valid (locally-minted) token
 *   - introspect on an expired token
 *
 * Run as: pnpm wavex:cloud-client:smoke
 *
 * Exit 0 on all-pass, 1 on any failure.
 */
import { mkdtempSync, rmSync, readFileSync, statSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join } from "node:path";

// Load env so WAVEX_DEVICE_JWT_SECRET is available for sign/verify steps.
try {
  const envPath = join(homedir(), ".wavex-os", "state", ".env");
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
} catch { /* no env file — some tests will skip */ }

// Sandbox the token path so we never touch the real one.
const sandbox = mkdtempSync(join(tmpdir(), "wavex-cloud-client-smoke-"));
process.env.WAVEX_DEVICE_TOKEN_PATH = join(sandbox, "device-token.json");

const {
  loadConfig,
  readBundle,
  writeBundle,
  deleteBundle,
  introspectBundle,
  getValidAccessToken,
} = await import("../src/index.ts");
const { _signDeviceJwt_TEST_ONLY } = await import("../../auth-shim/src/device-jwt.ts");

let pass = 0;
let fail = 0;
function check(label, cond, detail) {
  if (cond) {
    console.log(`  ✓ ${label}`);
    pass++;
  } else {
    console.log(`  ✗ ${label} ${detail ? "— " + detail : ""}`);
    fail++;
  }
}

console.log("\n── Config ──");
const cfg = loadConfig();
check("functionsUrl default", cfg.functionsUrl.includes("functions/v1"));
check("consoleUrl default", cfg.consoleUrl.includes("/os/link"));
check("tokenPath = sandboxed", cfg.tokenPath.startsWith(sandbox));
check("timeoutMs > 0", cfg.timeoutMs > 0);

console.log("\n── Token store: empty state ──");
check("readBundle returns null when no file", (await readBundle()) === null);
let threw = false;
try { await getValidAccessToken(); } catch (e) {
  threw = String(e).includes("no_paired_device");
}
check("getValidAccessToken throws no_paired_device when bundle absent", threw);
const introspect0 = await introspectBundle();
check("introspect returns reason=no_bundle when bundle absent",
  !introspect0.ok && introspect0.reason === "no_bundle");

console.log("\n── Token store: round-trip + perms ──");
if (!process.env.WAVEX_DEVICE_JWT_SECRET) {
  console.log("  ⚠ WAVEX_DEVICE_JWT_SECRET not set — skipping mint+verify");
} else {
  const now = Math.floor(Date.now() / 1000);
  const goodToken = _signDeviceJwt_TEST_ONLY({
    sub: "00000000-0000-0000-0000-000000000abc",
    device_id: "00000000-0000-0000-0000-000000000def",
    exp: now + 3600,
  });
  await writeBundle({
    access_token: goodToken,
    refresh_token: "refresh-opaque",
    access_token_expires_at: now + 3600,
    obtained_at: now,
    user_id: "00000000-0000-0000-0000-000000000abc",
    device_id: "00000000-0000-0000-0000-000000000def",
  });
  const stat = statSync(cfg.tokenPath);
  check("file mode = 600 (octal)", (stat.mode & 0o777) === 0o600,
    `actual: ${(stat.mode & 0o777).toString(8)}`);
  const re = await readBundle();
  check("readBundle returns the written bundle", re?.access_token === goodToken);
  const token = await getValidAccessToken();
  check("getValidAccessToken returns access_token when not near expiry", token === goodToken);
  const introspect1 = await introspectBundle();
  check("introspect on valid bundle returns ok=true",
    introspect1.ok && introspect1.bundle?.access_token === goodToken);

  // Expired token introspection
  console.log("\n── Token store: expired token introspect ──");
  const expiredToken = _signDeviceJwt_TEST_ONLY({
    sub: "00000000-0000-0000-0000-000000000abc",
    device_id: "00000000-0000-0000-0000-000000000def",
    exp: now - 60,
    iat: now - 3660,
  });
  await writeBundle({
    access_token: expiredToken,
    refresh_token: "refresh-opaque",
    access_token_expires_at: now - 60,
    obtained_at: now - 3660,
    user_id: "00000000-0000-0000-0000-000000000abc",
    device_id: "00000000-0000-0000-0000-000000000def",
  });
  const introspect2 = await introspectBundle();
  check("introspect on expired bundle returns reason=expired",
    !introspect2.ok && introspect2.reason === "expired");
}

console.log("\n── Token store: delete ──");
await deleteBundle();
check("readBundle returns null after delete", (await readBundle()) === null);
await deleteBundle();  // idempotent
check("deleteBundle on missing file does not throw", true);

// Tidy sandbox
rmSync(sandbox, { recursive: true, force: true });

console.log(`\nResult: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
