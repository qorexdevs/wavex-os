#!/usr/bin/env node
/**
 * `wavex-os login` — pair this machine to a WaveX OS Console account.
 *
 * Modeled on `gh auth login` / Claude Code OAuth device flow. No
 * password ever leaves the user's browser — local box only holds a
 * short-lived device JWT + a refresh token that the cloud can revoke.
 *
 * Usage:
 *   node scripts/wavex-login.mjs
 *
 * Or via package.json script `pnpm wavex:login`.
 *
 * Behavior:
 *   1. POST os-link-device → user_code + device_code
 *   2. Open the user's default browser to <console>/link?code=<user_code>
 *   3. Print the code in big letters in the terminal so the user can
 *      confirm in the browser
 *   4. Poll os-device-token until the user clicks "Pair this device"
 *   5. Write the resulting bundle to ~/.wavex-os/device-token.json
 *      (chmod 600 — owner-only)
 *   6. Verify the access token locally + print the bound user/device IDs
 *
 * Exit codes:
 *   0 — paired successfully
 *   2 — user code expired (didn't claim in time)
 *   3 — network / cloud-side error (message printed)
 *
 * Env overrides (see packages/cloud-client/src/config.ts):
 *   WAVEX_CLOUD_FUNCTIONS_URL, WAVEX_CONSOLE_URL, WAVEX_CLOUD_PUBLIC_KEY
 */
import { execSync } from "node:child_process";
import { runLogin, introspectBundle } from "../packages/cloud-client/src/index.ts";

// Load ~/.wavex-os/state/.env so WAVEX_* env vars are available
// (login itself doesn't need WAVEX_DEVICE_JWT_SECRET — the cloud signs;
// we just verify the result locally to confirm it parses).
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

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
} catch { /* no state/.env — that's fine for login (cloud-side config) */ }

function openBrowser(url) {
  try {
    if (process.platform === "darwin") execSync(`open "${url}"`);
    else if (process.platform === "win32") execSync(`start "" "${url}"`);
    else execSync(`xdg-open "${url}"`);
    return true;
  } catch {
    return false;
  }
}

console.log("");
console.log("  WaveX OS — pair this machine to your console account");
console.log("  ─────────────────────────────────────────────────────");
console.log("");

try {
  await runLogin({
    onCode: ({ userCode, verificationUrl, expiresIn }) => {
      console.log(`  Your pairing code:    \x1b[1m\x1b[36m${userCode}\x1b[0m`);
      console.log(`  Opens in browser:     ${verificationUrl}`);
      console.log(`  Code expires in:      ${Math.floor(expiresIn / 60)} min`);
      console.log("");
      const opened = openBrowser(verificationUrl);
      if (opened) {
        console.log(`  ↗ Browser opened. Confirm the code above matches, then click "Pair this device".`);
      } else {
        console.log(`  ⚠ Couldn't auto-open the browser. Copy the URL above into a browser tab.`);
      }
      console.log("");
      process.stdout.write("  Waiting for you to claim the code");
    },
    onPoll: (attempt) => {
      if (attempt > 1 && attempt % 5 === 0) process.stdout.write(".");
    },
    onPaired: ({ user_id, device_id }) => {
      console.log("");
      console.log("");
      console.log(`  \x1b[32m✓\x1b[0m Paired!`);
      console.log(`    user_id:     ${user_id}`);
      console.log(`    device_id:   ${device_id}`);
      console.log("");
    },
  });

  // Self-introspect — confirm the stored JWT parses + verifies locally
  // (mostly catches WAVEX_DEVICE_JWT_SECRET mismatches between sides).
  const introspect = await introspectBundle();
  if (!introspect.ok) {
    console.log(`  \x1b[33m⚠\x1b[0m Token written but local verify failed: ${introspect.reason}`);
    console.log(`    This usually means WAVEX_DEVICE_JWT_SECRET differs between local and cloud.`);
    console.log(`    Cloud team needs to confirm both sides agree on the same key.`);
    console.log("");
    process.exit(0); // still paired — refresh will work; just no local verify
  }
  console.log("  Token verified locally. Ready for os-inference + spend rail.");
  console.log("");
  process.exit(0);
} catch (err) {
  console.log("");
  console.log("");
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.startsWith("pairing_timeout")) {
    console.log(`  \x1b[31m✗\x1b[0m Pairing code expired. Run \`wavex-os login\` again to get a fresh code.`);
    process.exit(2);
  }
  console.log(`  \x1b[31m✗\x1b[0m Pairing failed: ${msg}`);
  process.exit(3);
}
