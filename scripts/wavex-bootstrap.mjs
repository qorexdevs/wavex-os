#!/usr/bin/env node
/**
 * WaveX OS one-paste bootstrap. The customer pastes:
 *
 *   cd ~/wavex-os && pnpm wavex:start
 *
 * …and this script brings the whole runtime online: pull latest, install
 * deps, ensure Claude Code is on PATH, pair the device if needed, start
 * the claude-code-proxy in background, register the local-ops daemon as
 * a system service, run one cycle to get baseline state, and exit. From
 * there the daemon takes over — including spawning Claude Code via the
 * doctor when anything looks broken.
 *
 * Idempotent. Safe to re-run. Each stage is independent — a failure in
 * one doesn't abort the rest. Final summary tells the customer what's
 * green and what needs attention.
 *
 * Cross-platform: macOS (launchd), Windows (Scheduled Task), Linux
 * (systemd-user). Falls back to spawn-detached if service registration
 * fails.
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
import net from "node:net";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const STATE_DIR = path.join(homedir(), ".wavex-os");
const DEVICE_TOKEN_FILE = path.join(STATE_DIR, "device-token.json");
const PROXY_PORT = Number(process.env.WAVEX_PROXY_PORT ?? 11434);
const PROXY_BIN = path.join(REPO_ROOT, "packages", "claude-code-proxy", "bin", "wavex-os-proxy.mjs");
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

function portOpen(port, host = "127.0.0.1", timeoutMs = 500) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    let done = false;
    const finish = (ok) => { if (done) return; done = true; sock.destroy(); resolve(ok); };
    sock.setTimeout(timeoutMs);
    sock.once("connect", () => finish(true));
    sock.once("timeout", () => finish(false));
    sock.once("error", () => finish(false));
    sock.connect(port, host);
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

async function stageStartProxy() {
  // Already running? Skip.
  if (await portOpen(PROXY_PORT)) {
    printStage("proxy", "ok", `already running on :${PROXY_PORT}`);
    return;
  }

  // Try platform-specific service registration first; fall back to
  // spawn-detached if that's not available or fails.
  let registered = false;
  if (IS_MAC) {
    registered = await registerProxyLaunchd();
  } else if (IS_WIN) {
    registered = await registerProxyScheduledTask();
  } else if (IS_LINUX) {
    registered = await registerProxySystemd();
  }

  if (!registered) {
    // Fall back to a detached child process. Survives this terminal
    // session but won't restart on reboot — customer would need to
    // re-run `pnpm wavex:start` after each reboot.
    const child = spawn(process.execPath, [PROXY_BIN], {
      detached: true,
      stdio: "ignore",
      cwd: REPO_ROOT,
    });
    child.unref();
    printInfo(`  proxy started detached (pid ${child.pid}; survives this shell, not reboots)`);
  }

  // Wait up to 8 s for the proxy to be ready.
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (await portOpen(PROXY_PORT)) {
      printStage("proxy", "ok", `:${PROXY_PORT} ${registered ? "(as service)" : "(detached)"}`);
      return;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  printStage("proxy", "warn", "didn't come up within 8s — check ~/.wavex-os/state/wavex-os-proxy.log");
}

async function registerProxyLaunchd() {
  const label = "com.wavex-os.claude-code-proxy";
  const plistPath = path.join(homedir(), "Library", "LaunchAgents", `${label}.plist`);
  const stateDir = path.join(STATE_DIR, "state");
  await fs.mkdir(stateDir, { recursive: true });

  const nodeBin = process.execPath;
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${nodeBin}</string>
    <string>${PROXY_BIN}</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>WAVEX_PROXY_PORT</key><string>${PROXY_PORT}</string>
    <key>PATH</key><string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
  </dict>
  <key>WorkingDirectory</key><string>${REPO_ROOT}</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${stateDir}/claude-code-proxy.log</string>
  <key>StandardErrorPath</key><string>${stateDir}/claude-code-proxy.log</string>
</dict>
</plist>
`;
  try {
    await fs.mkdir(path.dirname(plistPath), { recursive: true });
    await fs.writeFile(plistPath, plist, "utf8");
    // unload-then-load for idempotency.
    await spawnAsync("launchctl", ["unload", plistPath]);
    const load = await spawnAsync("launchctl", ["load", "-w", plistPath]);
    return load.code === 0;
  } catch {
    return false;
  }
}

async function registerProxyScheduledTask() {
  const taskName = "WaveX-OS Claude Code Proxy";
  // Use the PowerShell APIs — much cleaner than schtasks XML.
  const ps1 = `
$ErrorActionPreference = "Stop"
schtasks /Delete /TN "${taskName}" /F 2>$null | Out-Null
$node = (Get-Command node).Source
$action = New-ScheduledTaskAction -Execute $node -Argument "\`"${PROXY_BIN.replace(/\\/g, "\\\\")}\`""
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 99 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Days 365)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive
Register-ScheduledTask -TaskName "${taskName}" -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "WaveX OS local proxy for Claude Code inference." | Out-Null
schtasks /Run /TN "${taskName}" | Out-Null
`;
  try {
    const r = await spawnAsync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps1]);
    return r.code === 0;
  } catch {
    return false;
  }
}

async function registerProxySystemd() {
  const unitName = "wavex-os-claude-code-proxy.service";
  const unitDir = path.join(homedir(), ".config", "systemd", "user");
  await fs.mkdir(unitDir, { recursive: true });
  const unit = `[Unit]
Description=WaveX OS Claude Code Proxy
After=network-online.target

[Service]
Type=simple
ExecStart=${process.execPath} ${PROXY_BIN}
WorkingDirectory=${REPO_ROOT}
Restart=always
RestartSec=5
Environment=WAVEX_PROXY_PORT=${PROXY_PORT}
StandardOutput=append:${STATE_DIR}/state/claude-code-proxy.log
StandardError=append:${STATE_DIR}/state/claude-code-proxy.log

[Install]
WantedBy=default.target
`;
  try {
    await fs.writeFile(path.join(unitDir, unitName), unit, "utf8");
    await spawnAsync("systemctl", ["--user", "daemon-reload"]);
    await spawnAsync("systemctl", ["--user", "enable", unitName]);
    const r = await spawnAsync("systemctl", ["--user", "start", unitName]);
    return r.code === 0;
  } catch {
    return false;
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
    await stageStartProxy();
  } catch (err) {
    printStage("proxy", "warn", err.message ?? String(err));
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
  printInfo(`State + logs: ~/.wavex-os/`);
  printInfo("");
}

main().catch((err) => {
  process.stderr.write(`\n[wavex-os] bootstrap fatal: ${err.message ?? err}\n`);
  process.exit(1);
});
