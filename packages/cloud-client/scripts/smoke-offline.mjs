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
 *   - CLI dispatcher: version/version --json/--help/bare/unknown-command exit codes
 *   - `status --json` machine-readable output (unpaired + paired)
 *   - `whoami --json` machine-readable output (unpaired + paired)
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
  if (process.platform === "win32") {
    console.log("  ⚠ win32 — POSIX file modes don't apply, skipping chmod 600 check");
  } else {
    const stat = statSync(cfg.tokenPath);
    check("file mode = 600 (octal)", (stat.mode & 0o777) === 0o600,
      `actual: ${(stat.mode & 0o777).toString(8)}`);
  }
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

console.log("\n── CLI dispatcher (offline paths) ──");
const { runCli } = await import("../src/cli.ts");
const pkgVersion = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
).version;

// Capture console.log so the help/version output doesn't pollute the smoke log.
const origLog = console.log;
async function runCapture(argv) {
  const lines = [];
  console.log = (...a) => lines.push(a.join(" "));
  try {
    const code = await runCli(argv);
    return { code, out: lines.join("\n") };
  } finally {
    console.log = origLog;
  }
}

const ver = await runCapture(["version"]);
check("`version` exits 0", ver.code === 0);
check("`version` prints the package.json version", ver.out.trim() === pkgVersion,
  `actual: ${ver.out.trim()}`);
const verFlag = await runCapture(["--version"]);
check("`--version` matches `version`", verFlag.code === 0 && verFlag.out === ver.out);
const verJson = await runCapture(["version", "--json"]);
check("`version --json` exits 0", verJson.code === 0);
let verObj = null;
try { verObj = JSON.parse(verJson.out); } catch { /* fails check below */ }
check("`version --json` reports name + version + runtime",
  verObj?.version === pkgVersion && typeof verObj?.node === "string" && typeof verObj?.platform === "string",
  `actual: ${verJson.out}`);
const help = await runCapture(["--help"]);
check("`--help` exits 0", help.code === 0);
check("help lists cloud + installer subcommands",
  ["login", "status", "logout", "version", "init", "doctor"].every((s) => help.out.includes(s)));
const bare = await runCapture([]);
check("bare invocation shows help and exits 0", bare.code === 0 && bare.out.includes("login"));
const unknown = await runCapture(["frobnicate"]);
check("unknown command exits 1", unknown.code === 1);
check("unknown command names the offender", unknown.out.includes("frobnicate"));

console.log("\n── CLI: status --json ──");
const jsonUnpaired = await runCapture(["status", "--json"]);
check("`status --json` unpaired exits 1", jsonUnpaired.code === 1);
let unpairedObj = null;
try { unpairedObj = JSON.parse(jsonUnpaired.out); } catch { /* fails check below */ }
check("`status --json` unpaired prints {paired:false}", unpairedObj?.paired === false,
  `actual: ${jsonUnpaired.out}`);
if (!process.env.WAVEX_DEVICE_JWT_SECRET) {
  console.log("  ⚠ WAVEX_DEVICE_JWT_SECRET not set — skipping paired status --json");
} else {
  const now2 = Math.floor(Date.now() / 1000);
  const statusToken = _signDeviceJwt_TEST_ONLY({
    sub: "00000000-0000-0000-0000-000000000abc",
    device_id: "00000000-0000-0000-0000-000000000def",
    exp: now2 + 3600,
  });
  await writeBundle({
    access_token: statusToken,
    refresh_token: "refresh-opaque",
    access_token_expires_at: now2 + 3600,
    obtained_at: now2,
    user_id: "00000000-0000-0000-0000-000000000abc",
    device_id: "00000000-0000-0000-0000-000000000def",
  });
  const jsonPaired = await runCapture(["status", "--json"]);
  check("`status --json` paired exits 0", jsonPaired.code === 0);
  let pairedObj = null;
  try { pairedObj = JSON.parse(jsonPaired.out); } catch { /* fails checks below */ }
  check("`status --json` paired reports valid token",
    pairedObj?.paired === true && pairedObj?.valid === true);
  check("`status --json` includes device_id and expiry",
    pairedObj?.device_id === "00000000-0000-0000-0000-000000000def" &&
    typeof pairedObj?.access_token_expires_in_sec === "number" &&
    pairedObj.access_token_expires_in_sec > 0);
  await deleteBundle();
}

console.log("\n── CLI: logout --json ──");
const logoutEmpty = await runCapture(["logout", "--json"]);
check("`logout --json` with no token exits 0", logoutEmpty.code === 0);
let logoutEmptyObj = null;
try { logoutEmptyObj = JSON.parse(logoutEmpty.out); } catch { /* fails check below */ }
check("`logout --json` reports had_token:false when nothing on disk",
  logoutEmptyObj?.logged_out === true && logoutEmptyObj?.had_token === false,
  `actual: ${logoutEmpty.out}`);
if (process.env.WAVEX_DEVICE_JWT_SECRET) {
  const now3 = Math.floor(Date.now() / 1000);
  const logoutToken = _signDeviceJwt_TEST_ONLY({
    sub: "00000000-0000-0000-0000-000000000abc",
    device_id: "00000000-0000-0000-0000-000000000def",
    exp: now3 + 3600,
  });
  await writeBundle({
    access_token: logoutToken,
    refresh_token: "refresh-opaque",
    access_token_expires_at: now3 + 3600,
    obtained_at: now3,
    user_id: "00000000-0000-0000-0000-000000000abc",
    device_id: "00000000-0000-0000-0000-000000000def",
  });
  const logoutPaired = await runCapture(["logout", "--json"]);
  let logoutPairedObj = null;
  try { logoutPairedObj = JSON.parse(logoutPaired.out); } catch { /* fails check below */ }
  check("`logout --json` reports had_token:true and removes the bundle",
    logoutPaired.code === 0 && logoutPairedObj?.had_token === true &&
    (await readBundle()) === null,
    `actual: ${logoutPaired.out}`);
}

console.log("\n── CLI: whoami --json ──");
const whoamiUnpaired = await runCapture(["whoami", "--json"]);
check("`whoami --json` unpaired exits 1", whoamiUnpaired.code === 1);
let whoamiUnpairedObj = null;
try { whoamiUnpairedObj = JSON.parse(whoamiUnpaired.out); } catch { /* fails check below */ }
check("`whoami --json` unpaired prints {paired:false}", whoamiUnpairedObj?.paired === false,
  `actual: ${whoamiUnpaired.out}`);
if (!process.env.WAVEX_DEVICE_JWT_SECRET) {
  console.log("  ⚠ WAVEX_DEVICE_JWT_SECRET not set — skipping paired whoami --json");
} else {
  const now4 = Math.floor(Date.now() / 1000);
  const whoamiToken = _signDeviceJwt_TEST_ONLY({
    sub: "00000000-0000-0000-0000-000000000abc",
    device_id: "00000000-0000-0000-0000-000000000def",
    exp: now4 + 3600,
  });
  await writeBundle({
    access_token: whoamiToken,
    refresh_token: "refresh-opaque",
    access_token_expires_at: now4 + 3600,
    obtained_at: now4,
    user_id: "00000000-0000-0000-0000-000000000abc",
    device_id: "00000000-0000-0000-0000-000000000def",
  });
  const whoamiPaired = await runCapture(["whoami", "--json"]);
  check("`whoami --json` paired exits 0", whoamiPaired.code === 0);
  let whoamiPairedObj = null;
  try { whoamiPairedObj = JSON.parse(whoamiPaired.out); } catch { /* fails checks below */ }
  check("`whoami --json` paired reports user_id + device_id + valid",
    whoamiPairedObj?.paired === true && whoamiPairedObj?.valid === true &&
    whoamiPairedObj?.user_id === "00000000-0000-0000-0000-000000000abc" &&
    whoamiPairedObj?.device_id === "00000000-0000-0000-0000-000000000def",
    `actual: ${whoamiPaired.out}`);
  check("`whoami --json` paired reports a positive expiry like status does",
    typeof whoamiPairedObj?.access_token_expires_in_sec === "number" &&
    whoamiPairedObj.access_token_expires_in_sec > 0,
    `actual: ${whoamiPaired.out}`);

  // Plain whoami on a valid token should hint at expiry like status does
  const whoamiPairedHuman = await runCapture(["whoami"]);
  check("`whoami` paired-and-valid prints an expiry hint",
    /expires in -?\d+ min/.test(whoamiPairedHuman.out),
    `actual: ${whoamiPairedHuman.out}`);

  // Paired but expired: whoami --json should surface a reason like status does
  const expiredWhoamiToken = _signDeviceJwt_TEST_ONLY({
    sub: "00000000-0000-0000-0000-000000000abc",
    device_id: "00000000-0000-0000-0000-000000000def",
    exp: now4 - 3600,
  });
  await writeBundle({
    access_token: expiredWhoamiToken,
    refresh_token: "refresh-opaque",
    access_token_expires_at: now4 - 3600,
    obtained_at: now4 - 7200,
    user_id: "00000000-0000-0000-0000-000000000abc",
    device_id: "00000000-0000-0000-0000-000000000def",
  });
  const whoamiExpired = await runCapture(["whoami", "--json"]);
  let whoamiExpiredObj = null;
  try { whoamiExpiredObj = JSON.parse(whoamiExpired.out); } catch { /* fails check below */ }
  check("`whoami --json` paired-but-expired reports valid=false + reason",
    whoamiExpiredObj?.paired === true && whoamiExpiredObj?.valid === false &&
    typeof whoamiExpiredObj?.reason === "string",
    `actual: ${whoamiExpired.out}`);
  check("`whoami --json` paired-but-expired reports a non-positive expiry",
    typeof whoamiExpiredObj?.access_token_expires_in_sec === "number" &&
    whoamiExpiredObj.access_token_expires_in_sec <= 0,
    `actual: ${whoamiExpired.out}`);

  // Same expired bundle, plain whoami should print the reason inline, not just a ⚠
  const whoamiExpiredHuman = await runCapture(["whoami"]);
  check("`whoami` paired-but-expired prints the reason inline",
    whoamiExpiredHuman.out.includes(whoamiExpiredObj?.reason ?? " "),
    `actual: ${whoamiExpiredHuman.out}`);
  await deleteBundle();
}

// Tidy sandbox
rmSync(sandbox, { recursive: true, force: true });

console.log(`\nResult: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
