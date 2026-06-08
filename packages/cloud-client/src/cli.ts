/**
 * `wavex-os` CLI — subcommand dispatcher.
 *
 * This is the real, typechecked implementation behind the `wavex-os`
 * bin declared in package.json. The bin entrypoint (`bin/wavex-os.mjs`)
 * is a plain Node ESM shim that imports the built `dist/cli.js` and calls
 * `runCli()` here — no `tsx` loader, no re-exec dance.
 *
 * Subcommands:
 *   wavex-os login     pair this machine to a WaveX OS Console account
 *   wavex-os status    show the local pairing state (no network unless --refresh)
 *   wavex-os logout    delete the local device token bundle
 *   wavex-os version   print the cloud-client version
 *   wavex-os init      → delegated to apps/installer (npx wavex-os init)
 *   wavex-os doctor    → delegated to apps/installer
 *   wavex-os audit     → delegated to apps/installer
 *   wavex-os reset     → delegated to apps/installer
 *
 * Why split login out of apps/installer:
 *   apps/installer/** is a frozen path. The installer's bin only knows
 *   init/doctor/audit/reset. Rather than modify the frozen tree, this
 *   CLI owns the cloud-facing subcommands (login/status/logout) and
 *   transparently forwards the installer's own subcommands to it, so a
 *   single `wavex-os` binary covers the whole surface.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runLogin, introspectBundle } from "./index.js";
import { deleteBundle, getValidAccessToken, loadConfig } from "./index.js";

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

/** Subcommands handled by the frozen apps/installer bin. */
const INSTALLER_SUBCOMMANDS = new Set(["init", "doctor", "audit", "reset"]);

/**
 * Best-effort: hydrate process.env from ~/.wavex-os/state/.env so the
 * cloud-client picks up WAVEX_CLOUD_* / WAVEX_DEVICE_JWT_SECRET overrides.
 * Login itself only needs cloud config; verification needs the JWT secret.
 */
function loadStateEnv(): void {
  try {
    const envPath = join(homedir(), ".wavex-os", "state", ".env");
    for (const raw of readFileSync(envPath, "utf8").split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq < 1) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    /* no state/.env — fine; cloud config has sane defaults */
  }
}

function openBrowser(url: string): boolean {
  try {
    const cmd =
      process.platform === "darwin"
        ? "open"
        : process.platform === "win32"
          ? "start"
          : "xdg-open";
    // start needs an empty title arg on win32; spawn + detached so we don't block.
    const args = process.platform === "win32" ? ['""', url] : [url];
    const child = spawn(cmd, args, {
      stdio: "ignore",
      detached: true,
      shell: process.platform === "win32",
    });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

/** `wavex-os login` — full device-pairing flow. */
async function login(): Promise<number> {
  loadStateEnv();

  console.log("");
  console.log("  WaveX OS — pair this machine to your console account");
  console.log("  ─────────────────────────────────────────────────────");
  console.log("");

  try {
    await runLogin({
      onCode: ({ userCode, verificationUrl, expiresIn }) => {
        console.log(
          `  Your pairing code:    ${c.bold}${c.cyan}${userCode}${c.reset}`,
        );
        console.log(`  Opens in browser:     ${verificationUrl}`);
        console.log(
          `  Code expires in:      ${Math.floor(expiresIn / 60)} min`,
        );
        console.log("");
        const opened = openBrowser(verificationUrl);
        if (opened) {
          console.log(
            `  ↗ Browser opened. Confirm the code above matches, then click "Pair this device".`,
          );
        } else {
          console.log(
            `  ⚠ Couldn't auto-open the browser. Copy the URL above into a browser tab.`,
          );
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
        console.log(`  ${c.green}✓${c.reset} Paired!`);
        console.log(`    user_id:     ${user_id}`);
        console.log(`    device_id:   ${device_id}`);
        console.log("");
      },
    });

    // Customer machines never have WAVEX_DEVICE_JWT_SECRET — local verify is
    // meaningless there and the "no_secret" warning was just noise. Skip the
    // check silently when the env var is absent; only surface real failures.
    if (process.env.WAVEX_DEVICE_JWT_SECRET) {
      const introspect = await introspectBundle();
      if (!introspect.ok) {
        console.log(
          `  ${c.yellow}⚠${c.reset} Token written but local verify failed: ${introspect.reason}`,
        );
        console.log(
          `    This usually means WAVEX_DEVICE_JWT_SECRET differs between local and cloud.`,
        );
        console.log(
          `    Cloud team needs to confirm both sides agree on the same key.`,
        );
        console.log("");
        return 0; // still paired — refresh works; just no local verify
      }
      console.log(
        "  Token verified locally. Ready for os-inference + spend rail.",
      );
      console.log("");
    }
    return 0;
  } catch (err) {
    console.log("");
    console.log("");
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith("pairing_timeout")) {
      console.log(
        `  ${c.red}✗${c.reset} Pairing code expired. Run \`wavex-os login\` again to get a fresh code.`,
      );
      return 2;
    }
    console.log(`  ${c.red}✗${c.reset} Pairing failed: ${msg}`);
    return 3;
  }
}

/**
 * `wavex-os status` — show local pairing state.
 * --refresh forces a token refresh; --json emits one machine-readable line.
 */
async function status(argv: string[]): Promise<number> {
  loadStateEnv();
  const wantRefresh = argv.includes("--refresh");
  const asJson = argv.includes("--json");

  const introspect = await introspectBundle();
  if (!introspect.ok && introspect.reason === "no_bundle") {
    if (asJson) {
      console.log(JSON.stringify({ paired: false }));
      return 1;
    }
    console.log("");
    console.log(`  ${c.yellow}○${c.reset} Not paired.`);
    console.log(`    Run ${c.bold}wavex-os login${c.reset} to pair this machine.`);
    console.log("");
    return 1;
  }

  const bundle = introspect.bundle!;
  const now = Math.floor(Date.now() / 1000);
  const expiresInSec = bundle.access_token_expires_at - now;
  const cfg = loadConfig();

  if (asJson) {
    const out: Record<string, unknown> = {
      paired: true,
      valid: introspect.ok,
      user_id: bundle.user_id,
      device_id: bundle.device_id,
      token_path: cfg.tokenPath,
      functions_url: cfg.functionsUrl,
      access_token_expires_in_sec: expiresInSec,
    };
    if (!introspect.ok) out.reason = introspect.reason;
    if (wantRefresh) {
      try {
        await getValidAccessToken(cfg);
        out.refreshed = true;
      } catch (err) {
        out.refreshed = false;
        out.refresh_error = err instanceof Error ? err.message : String(err);
        console.log(JSON.stringify(out));
        return 3;
      }
    }
    console.log(JSON.stringify(out));
    return 0;
  }

  console.log("");
  if (introspect.ok) {
    console.log(`  ${c.green}✓${c.reset} Paired & token valid.`);
  } else {
    console.log(
      `  ${c.yellow}⚠${c.reset} Paired but access token not currently valid: ${introspect.reason}`,
    );
  }
  console.log(`    user_id:       ${bundle.user_id}`);
  console.log(`    device_id:     ${bundle.device_id}`);
  console.log(`    token path:    ${cfg.tokenPath}`);
  console.log(`    functions url: ${cfg.functionsUrl}`);
  if (expiresInSec > 0) {
    console.log(
      `    access token:  expires in ${Math.floor(expiresInSec / 60)} min`,
    );
  } else {
    console.log(
      `    access token:  expired ${Math.floor(-expiresInSec / 60)} min ago (auto-refreshes on next cloud call)`,
    );
  }

  if (wantRefresh) {
    try {
      await getValidAccessToken(cfg);
      console.log(`  ${c.green}✓${c.reset} Refreshed — token rotated.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ${c.red}✗${c.reset} Refresh failed: ${msg}`);
      console.log("");
      return 3;
    }
  }
  console.log("");
  return 0;
}

/** `wavex-os logout` — delete the local device token bundle. */
async function logout(): Promise<number> {
  loadStateEnv();
  const introspect = await introspectBundle();
  if (!introspect.ok && introspect.reason === "no_bundle") {
    console.log("");
    console.log(`  ${c.dim}Already logged out — no device token on disk.${c.reset}`);
    console.log("");
    return 0;
  }
  await deleteBundle();
  console.log("");
  console.log(`  ${c.green}✓${c.reset} Logged out — device token removed.`);
  console.log(
    `    ${c.dim}Note: this only clears local state. Revoke the device in the console to invalidate the refresh token cloud-side.${c.reset}`,
  );
  console.log("");
  return 0;
}

/**
 * Forward installer subcommands (init/doctor/audit/reset) to the frozen
 * apps/installer bin. Resolution order:
 *   1. repo-relative: <this-package>/../../apps/installer/bin/init.js
 *   2. fall back to `npx wavex-os-installer <cmd>`
 */
function delegateToInstaller(cmd: string, rest: string[]): Promise<number> {
  const here = dirname(fileURLToPath(import.meta.url)); // packages/cloud-client/src
  const repoInstaller = join(
    here,
    "..",
    "..",
    "..",
    "apps",
    "installer",
    "bin",
    "init.js",
  );

  return new Promise((resolve) => {
    let child;
    if (existsSync(repoInstaller)) {
      child = spawn(process.execPath, [repoInstaller, cmd, ...rest], {
        stdio: "inherit",
      });
    } else {
      // Installed standalone (npm i -g) — installer isn't colocated.
      child = spawn("npx", ["-y", "wavex-os-installer", cmd, ...rest], {
        stdio: "inherit",
        shell: process.platform === "win32",
      });
    }
    child.on("exit", (code) => resolve(code ?? 0));
    child.on("error", (err) => {
      console.error(
        `${c.red}Error:${c.reset} could not run installer subcommand "${cmd}": ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      resolve(1);
    });
  });
}

/** Read the package version from this package's package.json (works from src or dist). */
function readVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url)); // src/ or dist/
    const pkg = JSON.parse(readFileSync(join(here, "..", "package.json"), "utf8"));
    return typeof pkg.version === "string" ? pkg.version : "unknown";
  } catch {
    return "unknown";
  }
}

function help(): void {
  console.log(`
${c.bold}wavex-os${c.reset} — WaveX OS command line

${c.bold}Cloud / device pairing:${c.reset}
  ${c.cyan}wavex-os login${c.reset}              Pair this machine to your console account
  ${c.cyan}wavex-os status [--refresh] [--json]${c.reset} Show local pairing state
  ${c.cyan}wavex-os logout${c.reset}             Remove the local device token
  ${c.cyan}wavex-os version${c.reset}            Print the cloud-client version

${c.bold}Install / runtime ${c.dim}(delegated to wavex-os-installer)${c.reset}:
  ${c.cyan}wavex-os init [company]${c.reset}     Bootstrap a new WaveX OS company
  ${c.cyan}wavex-os doctor${c.reset}             Check environment prerequisites
  ${c.cyan}wavex-os audit${c.reset}              Probe the running stack
  ${c.cyan}wavex-os reset${c.reset}              Remove ~/.wavex-os (destructive)

  ${c.cyan}wavex-os --help${c.reset}             Show this message
  ${c.cyan}wavex-os --version${c.reset}          Print the version

${c.bold}Docs:${c.reset} https://github.com/aimerdoux/wavex-os
`);
}

/** Entrypoint. Returns the process exit code. */
export async function runCli(argv: string[] = process.argv.slice(2)): Promise<number> {
  const cmd = argv[0];
  const rest = argv.slice(1);

  if (!cmd || cmd === "--help" || cmd === "-h" || cmd === "help") {
    help();
    return 0;
  }

  if (cmd === "--version" || cmd === "-v" || cmd === "version") {
    console.log(readVersion());
    return 0;
  }

  switch (cmd) {
    case "login":
      return login();
    case "status":
      return status(rest);
    case "logout":
      return logout();
    default:
      if (INSTALLER_SUBCOMMANDS.has(cmd)) {
        return delegateToInstaller(cmd, rest);
      }
      console.log(`${c.red}Unknown command:${c.reset} ${cmd}\n`);
      help();
      return 1;
  }
}
