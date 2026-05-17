#!/usr/bin/env node
/**
 * WaveX OS one-paste bootstrap. The customer pastes:
 *
 *   cd ~/wavex-os && pnpm wavex:start
 *
 * …and this script brings the whole runtime online:
 *   1. Pull latest + install deps
 *   2. Ensure Claude Code CLI is on PATH (npm i -g if missing)
 *   3. Pair the WaveX OS device (Stripe / subscription / manifest channel)
 *   4. Authenticate to the customer's OWN Anthropic account (BYOC) so
 *      every wizard inference call bills against their Claude
 *      subscription — not ours. Closes the prompt-injection /
 *      inference-reuse window that the (now-deprecated) claude-code-proxy
 *      created.
 *   5. Deregister the legacy claude-code-proxy if a prior install
 *      registered it as a system service.
 *   6. Register the local-ops daemon as a system service (5-min cycle).
 *   7. Run one cycle to write baseline state + invoke the doctor if
 *      anything looks broken. From there the daemon takes over —
 *      including spawning the customer's local Claude Code via the
 *      doctor when state degrades.
 *
 * Idempotent. Safe to re-run. Each stage is independent — a failure in
 * one doesn't abort the rest. Final summary tells the customer what's
 * green and what needs attention.
 *
 * Cross-platform: macOS (launchd), Windows (Scheduled Task), Linux
 * (systemd-user).
 *
 * Logs go to stdout (the customer's terminal). Don't write secrets;
 * don't clean any state files (operator policy: logs are training data).
 */

import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
import path from "node:path";
import { homedir, platform } from "node:os";
import { spawn, spawnSync, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const STATE_DIR = path.join(homedir(), ".wavex-os");
const DEVICE_TOKEN_FILE = path.join(STATE_DIR, "device-token.json");
const DAEMON_SCRIPT = path.join(REPO_ROOT, "scripts", "wavex-local-ops-cycle.mjs");
const IS_WIN = platform() === "win32";
const IS_MAC = platform() === "darwin";
const IS_LINUX = platform() === "linux";

// ── tiny UI ────────────────────────────────────────────────────────

const SYM = {
  ok: "✓",
  warn: "⚠",
  fail: "✗",
  arrow: "→",
};

function printStage(name, status, detail = "") {
  const sym = status === "ok" ? SYM.ok : status === "warn" ? SYM.warn : SYM.fail;
  const colWidth = 30;
  const padding = " ".repeat(Math.max(1, colWidth - name.length));
  process.stdout.write(`[wavex-os] ${name}${padding}${sym} ${detail}\n`);
}

function printInfo(msg) {
  process.stdout.write(`[wavex-os] ${msg}\n`);
}

function spawnAsync(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { ...opts, shell: IS_WIN && !opts.shell === false });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d) => { stdout += d.toString(); });
    child.stderr?.on("data", (d) => { stderr += d.toString(); });
    child.on("error", (err) => resolve({ code: -1, stdout, stderr: String(err) }));
    child.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

// ── stages ─────────────────────────────────────────────────────────

async function stagePullLatest() {
  // Check we're in a git repo first
  try {
    await fs.access(path.join(REPO_ROOT, ".git"));
  } catch {
    printStage("pulling latest", "warn", "not a git repo, skipping");
    return;
  }

  // Stash dirty changes so pull doesn't fail
  const status = await spawnAsync("git", ["status", "--porcelain"], { cwd: REPO_ROOT });
  if (status.stdout.trim()) {
    const label = `auto-bootstrap-${new Date().toISOString().replace(/[:.]/g, "-")}`;
    await spawnAsync("git", ["stash", "push", "--include-untracked", "-m", label], { cwd: REPO_ROOT });
    printInfo(`  stashed local changes as "${label}" (recover with: git stash list)`);
  }

  const r = await spawnAsync("git", ["pull", "--ff-only"], { cwd: REPO_ROOT });
  if (r.code === 0) {
    if (r.stdout.includes("Already up to date") || r.stdout.includes("Already up-to-date")) {
      printStage("pulling latest", "ok", "already up to date");
    } else {
      printStage("pulling latest", "ok", "pulled new commits");
    }
  } else {
    printStage("pulling latest", "warn", `git pull failed: ${r.stderr.slice(0, 80)}`);
  }
}

async function stageInstallDeps() {
  const r = await spawnAsync("pnpm", ["install", "--prefer-offline"], { cwd: REPO_ROOT });
  if (r.code === 0) {
    printStage("installing deps", "ok", "pnpm install clean");
  } else {
    printStage("installing deps", "fail", `exit ${r.code}: ${r.stderr.slice(0, 80)}`);
    throw new Error("pnpm install failed");
  }
}

async function stageEnsureClaudeCli() {
  const r = await spawnAsync(IS_WIN ? "claude.cmd" : "claude", ["--version"], {});
  if (r.code === 0) {
    printStage("Claude Code CLI", "ok", r.stdout.trim().slice(0, 40));
    return;
  }
  // Install globally. On Windows this may show EPERM warnings during
  // cleanup but still succeeds — npm reports "changed N packages".
  printInfo("  installing @anthropic-ai/claude-code globally…");
  const inst = await spawnAsync(IS_WIN ? "npm.cmd" : "npm", ["install", "-g", "@anthropic-ai/claude-code"], {});
  if (inst.code === 0 || inst.stdout.includes("changed")) {
    printStage("Claude Code CLI", "ok", "installed");
  } else {
    printStage("Claude Code CLI", "warn", "install failed; rerun manually");
  }
}

async function stageEnsureDevicePairing() {
  let needsPair = false;
  if (!existsSync(DEVICE_TOKEN_FILE)) {
    needsPair = true;
  } else {
    // Try to introspect via the cloud-client. If the bundle is unreadable
    // or refresh fails, prompt for a re-pair.
    try {
      const cc = await import(
        path.join(REPO_ROOT, "packages", "cloud-client", "dist", "token-store.js"),
      );
      const got = await cc.introspectBundle();
      if (got.ok && got.bundle) {
        printStage("device pairing", "ok", `${got.bundle.user_id.slice(0, 8)}…`);
        return;
      }
      // Bundle exists but token/refresh is bad. Try a forced refresh.
      try {
        await cc.getValidAccessToken();
        const after = await cc.readBundle();
        if (after) {
          printStage("device pairing", "ok", `refreshed (${after.user_id.slice(0, 8)}…)`);
          return;
        }
      } catch {
        needsPair = true;
      }
    } catch (err) {
      printInfo(`  could not introspect bundle: ${err.message ?? err}`);
      needsPair = true;
    }
  }

  if (!needsPair) return;

  // Interactive: spawn `wavex-os login` and inherit stdio so the customer
  // can see the user_code + browser prompt.
  printInfo("  pairing this device (a browser window will open)…");
  const loginBin = path.join(REPO_ROOT, "packages", "cloud-client", "bin", "wavex-os.mjs");
  const r = await new Promise((resolve) => {
    const child = spawn(process.execPath, [loginBin, "login"], {
      stdio: "inherit",
      cwd: REPO_ROOT,
    });
    child.on("close", (code) => resolve(code ?? -1));
    child.on("error", () => resolve(-1));
  });
  if (r === 0) {
    printStage("device pairing", "ok", "paired");
  } else {
    printStage("device pairing", "fail", `wavex-os login exited ${r}`);
    throw new Error("device pairing failed; re-run `pnpm wavex:start` after fixing");
  }
}

async function stageClaudeAuth() {
  // Bring Your Own Claude: the customer authenticates against their OWN
  // Anthropic account. We don't proxy or subsidize their inference. This
  // closes the prompt-injection / inference-reuse vector that streaming
  // our Claude Max would have opened.
  //
  // Three paths:
  //   (a) Already authenticated → just verify and move on.
  //   (b) ANTHROPIC_API_KEY env is set → claude uses that, no login needed.
  //   (c) Not authenticated → run `claude auth login` interactively
  //       (browser pop-up) and re-verify.
  if (process.env.ANTHROPIC_API_KEY) {
    printStage("Claude auth", "ok", "ANTHROPIC_API_KEY in env");
    return;
  }

  const statusCmd = IS_WIN ? "claude.cmd" : "claude";
  const status = await spawnAsync(statusCmd, ["auth", "status"], {});
  const out = (status.stdout + status.stderr).toLowerCase();
  // `claude auth status` prints something like "logged in as foo@bar.com"
  // or "not logged in" / "no auth credentials found". Be forgiving about
  // exact wording — the CLI's output isn't a stable contract.
  const looksAuthed =
    status.code === 0 &&
    (out.includes("logged in") || out.includes("authenticated") || out.includes("active"));
  if (looksAuthed) {
    // Capture the email/login indicator from the status output (first
    // line, truncated) so the customer can see *which* account is wired.
    const firstLine = (status.stdout.trim().split("\n")[0] ?? "").slice(0, 60);
    printStage("Claude auth", "ok", firstLine || "logged in");
    return;
  }

  // Interactive login. Inherit stdio so the customer can see the
  // browser URL + paste the OAuth code back. `claude auth login` blocks
  // until the user completes or cancels.
  printInfo("  signing this machine into Claude (a browser window will open)…");
  const r = await new Promise((resolve) => {
    const child = spawn(statusCmd, ["auth", "login"], {
      stdio: "inherit",
      shell: IS_WIN,
    });
    child.on("close", (code) => resolve(code ?? -1));
    child.on("error", () => resolve(-1));
  });
  if (r !== 0) {
    printStage("Claude auth", "fail", `claude auth login exited ${r}`);
    throw new Error(
      "Claude authentication failed. Re-run `pnpm wavex:start` after running `claude auth login` manually, " +
        "or set ANTHROPIC_API_KEY in your environment.",
    );
  }
  // Re-verify.
  const after = await spawnAsync(statusCmd, ["auth", "status"], {});
  const firstLine = (after.stdout.trim().split("\n")[0] ?? "").slice(0, 60);
  printStage("Claude auth", "ok", firstLine || "logged in");
}

async function stageDeregisterProxy() {
  // BYOC pivot: the claude-code-proxy is deprecated. Earlier installs of
  // this bootstrap (commit be435a89) registered it as a system service.
  // Tear those down so customers don't keep a stale process running.
  // Idempotent — silently no-ops if nothing was registered.
  let deregistered = false;
  if (IS_MAC) {
    const plist = path.join(homedir(), "Library", "LaunchAgents", "com.wavex-os.claude-code-proxy.plist");
    if (existsSync(plist)) {
      await spawnAsync("launchctl", ["unload", plist]);
      await fs.unlink(plist).catch(() => {});
      deregistered = true;
    }
  } else if (IS_WIN) {
    const r = await spawnAsync("schtasks", ["/Delete", "/TN", "WaveX-OS Claude Code Proxy", "/F"]);
    if (r.code === 0) deregistered = true;
  } else if (IS_LINUX) {
    const unit = "wavex-os-claude-code-proxy.service";
    const unitPath = path.join(homedir(), ".config", "systemd", "user", unit);
    if (existsSync(unitPath)) {
      await spawnAsync("systemctl", ["--user", "stop", unit]);
      await spawnAsync("systemctl", ["--user", "disable", unit]);
      await fs.unlink(unitPath).catch(() => {});
      await spawnAsync("systemctl", ["--user", "daemon-reload"]);
      deregistered = true;
    }
  }
  if (deregistered) {
    printStage("legacy proxy", "ok", "removed (deprecated in BYOC mode)");
  }
}

async function stageRegisterDaemonService() {
  // Existing scripts handle this cross-platform. We call them rather
  // than duplicate.
  if (IS_MAC) {
    const r = await spawnAsync("pnpm", ["exec", "node", "scripts/render-launchd-templates.mjs"], { cwd: REPO_ROOT });
    if (r.code === 0) {
      // Load the local-ops plist.
      const plist = path.join(homedir(), "Library", "LaunchAgents", "com.wavex-os.local-ops.plist");
      if (existsSync(plist)) {
        await spawnAsync("launchctl", ["unload", plist]);
        const load = await spawnAsync("launchctl", ["load", "-w", plist]);
        printStage("daemon service", load.code === 0 ? "ok" : "warn", "launchd");
        return;
      }
    }
    printStage("daemon service", "warn", "render-launchd-templates didn't produce local-ops plist");
  } else if (IS_WIN) {
    const r = await spawnAsync("powershell.exe", [
      "-NoProfile", "-ExecutionPolicy", "Bypass",
      "-File", "scripts\\install-local-ops-windows.ps1",
    ], { cwd: REPO_ROOT });
    printStage("daemon service", r.code === 0 ? "ok" : "warn", "Scheduled Task");
  } else if (IS_LINUX) {
    // systemd templates exist but no installer script ships today —
    // just write the unit ourselves.
    const unitDir = path.join(homedir(), ".config", "systemd", "user");
    await fs.mkdir(unitDir, { recursive: true });
    const service = `[Unit]
Description=WaveX OS Local Ops daemon

[Service]
Type=oneshot
ExecStart=${process.execPath} ${DAEMON_SCRIPT}
WorkingDirectory=${REPO_ROOT}
StandardOutput=append:${STATE_DIR}/state/wavex-local-ops.log
StandardError=append:${STATE_DIR}/state/wavex-local-ops.log
`;
    const timer = `[Unit]
Description=Run WaveX OS Local Ops every 5 min

[Timer]
OnBootSec=30
OnUnitActiveSec=5min
AccuracySec=30s

[Install]
WantedBy=timers.target
`;
    await fs.writeFile(path.join(unitDir, "wavex-local-ops.service"), service, "utf8");
    await fs.writeFile(path.join(unitDir, "wavex-local-ops.timer"), timer, "utf8");
    await spawnAsync("systemctl", ["--user", "daemon-reload"]);
    await spawnAsync("systemctl", ["--user", "enable", "wavex-local-ops.timer"]);
    const r = await spawnAsync("systemctl", ["--user", "start", "wavex-local-ops.timer"]);
    printStage("daemon service", r.code === 0 ? "ok" : "warn", "systemd-user");
  }
}

async function stageRunFirstCycle() {
  // Run the daemon ONCE in the foreground so the customer immediately
  // sees a state file written + the doctor invoked if anything needs
  // fixing.
  const r = await spawnAsync(process.execPath, [DAEMON_SCRIPT], {
    cwd: REPO_ROOT,
    env: { ...process.env },
  });
  // Daemon always exits 0. The interesting signal is in the state file.
  const stateFile = path.join(STATE_DIR, "local-ops-state.json");
  if (existsSync(stateFile)) {
    try {
      const state = JSON.parse(await fs.readFile(stateFile, "utf8"));
      const action = state.requires_user_action;
      if (action) {
        printStage("install audit", "warn", `${action.reason} — ${action.button_label}`);
      } else {
        printStage("install audit", "ok", "no issues found");
      }
    } catch {
      printStage("install audit", "warn", "could not parse state");
    }
  } else {
    printStage("install audit", "warn", "daemon didn't write a state file");
  }
}

// ── main ───────────────────────────────────────────────────────────

async function main() {
  process.stdout.write("\n");
  printInfo(`bootstrap on ${platform()} — repo at ${REPO_ROOT}`);

  try {
    await stagePullLatest();
  } catch (err) {
    printStage("pulling latest", "warn", err.message ?? String(err));
  }

  await stageInstallDeps();

  try {
    await stageEnsureClaudeCli();
  } catch (err) {
    printStage("Claude Code CLI", "warn", err.message ?? String(err));
  }

  try {
    await stageEnsureDevicePairing();
  } catch (err) {
    printStage("device pairing", "fail", err.message ?? String(err));
    printInfo("");
    printInfo("Bootstrap stopped: device pairing is required to continue.");
    printInfo("Re-run `pnpm wavex:start` after pairing succeeds.");
    process.exit(1);
  }

  try {
    await stageClaudeAuth();
  } catch (err) {
    printStage("Claude auth", "fail", err.message ?? String(err));
    printInfo("");
    printInfo("Bootstrap stopped: Claude authentication is required to continue.");
    printInfo("The wizard's inference runs on YOUR Claude subscription (BYOC model).");
    printInfo("Re-run `pnpm wavex:start` after `claude auth login` succeeds, or set ANTHROPIC_API_KEY.");
    process.exit(1);
  }

  try {
    await stageDeregisterProxy();
  } catch (err) {
    printStage("legacy proxy", "warn", err.message ?? String(err));
  }

  try {
    await stageRegisterDaemonService();
  } catch (err) {
    printStage("daemon service", "warn", err.message ?? String(err));
  }

  try {
    await stageRunFirstCycle();
  } catch (err) {
    printStage("install audit", "warn", err.message ?? String(err));
  }

  process.stdout.write("\n");
  printInfo(`Ready. ${SYM.arrow} http://localhost:5173/onboarding (run \`pnpm dev\` to start the wizard)`);
  printInfo(`Wizard inference runs on your local Claude (BYOC). State + logs at ~/.wavex-os/`);
  printInfo("");
}

main().catch((err) => {
  process.stderr.write(`\n[wavex-os] bootstrap fatal: ${err.message ?? err}\n`);
  process.exit(1);
});
