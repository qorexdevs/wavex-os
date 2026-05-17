#!/usr/bin/env node
/**
 * WaveX Local Ops — customer-side self-healing daemon.
 *
 * Runs every 5 min via launchd (Mac) / Scheduled Task (Windows) / systemd (Linux).
 * Performs ALL stale-state maintenance autonomously so the customer never has
 * to type a terminal command to fix anything.
 *
 * Cycle:
 *   1. Token refresh check  — read device bundle, refresh if expiring soon.
 *   2. Git update check     — fetch + fast-forward pull if behind.
 *   3. Install/build        — pnpm install + per-package build if git pulled.
 *   4. Process health check — verify dev servers alive via port-bound checks;
 *                             kickstart launchd jobs that are dead.
 *   5. Build staleness      — rebuild packages with src newer than dist.
 *   6. Write state file     — ~/.wavex-os/local-ops-state.json (atomic).
 *
 * Each check is independent; one failing never aborts the cycle. Always
 * exits 0 so launchd/cron doesn't back off our cadence.
 *
 * State file contract is FROZEN — Phase C UI reads schema_version=1.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { homedir, platform } from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import net from "node:net";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_VERSION = 1;
const CYCLE_INTERVAL_SEC = 300;
const TOKEN_REFRESH_THRESHOLD_SEC = 600; // 10 min
const STATE_FILE = path.join(homedir(), ".wavex-os", "local-ops-state.json");
const DEVICE_TOKEN_FILE = path.join(homedir(), ".wavex-os", "device-token.json");
const CLOUD_PUSH_LAST_FILE = path.join(homedir(), ".wavex-os", "cloud-push-last.json");
const CLOUD_PUSH_URL =
  process.env.WAVEX_OS_HEALTH_PUSH_URL ??
  "https://ngvtgraldybxdbgkihfj.supabase.co/functions/v1/os-instance-health";
const CLOUD_PUSH_MIN_INTERVAL_SEC = 15 * 60; // heartbeat even when nothing changes
const CLOUD_PUSH_TIMEOUT_MS = 5000;
const IS_WIN = platform() === "win32";

// Ports we expect dev servers to bind. Cheap and reliable cross-platform
// "is the process alive" proxy.
const PROCESS_PORTS = {
  mock_core: 3101,
  op_omega_server: 3101, // mock-core hosts op-omega routes
  paperclip: 3100,
};

// Process → launchd label mapping (Mac only). On Windows/Linux we just
// flag requires_user_action since we can't auto-restart without a scheduler.
const PROCESS_LAUNCHD_LABEL = {
  mock_core: "com.wavex-os.mock-core",
  op_omega_server: "com.wavex-os.op-omega-server",
  paperclip: "com.wavex-os.paperclip",
};

// ---------- helpers ----------

function spawnCapture(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { ...opts, shell: IS_WIN });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr?.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("error", (err) => resolve({ code: -1, stdout, stderr: String(err) }));
    child.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

function portOpen(port, host = "127.0.0.1", timeoutMs = 500) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      sock.destroy();
      resolve(ok);
    };
    sock.setTimeout(timeoutMs);
    sock.once("connect", () => finish(true));
    sock.once("timeout", () => finish(false));
    sock.once("error", () => finish(false));
    sock.connect(port, host);
  });
}

async function findRepoRoot() {
  if (process.env.WAVEX_OS_REPO_ROOT) return process.env.WAVEX_OS_REPO_ROOT;
  // Walk up from this script: scripts/ → repo root.
  const candidate = path.resolve(__dirname, "..");
  try {
    const pkgRaw = await fs.readFile(path.join(candidate, "package.json"), "utf8");
    const pkg = JSON.parse(pkgRaw);
    if (pkg.name === "wavex-os" || pkg.name?.startsWith("@wavex-os/")) return candidate;
    return candidate; // best-effort
  } catch {
    const r = await spawnCapture("git", ["rev-parse", "--show-toplevel"], { cwd: __dirname });
    if (r.code === 0) return r.stdout.trim();
    return candidate;
  }
}

async function atomicWriteJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, filePath);
}

// ---------- checks ----------

async function checkToken(repoRoot) {
  const result = { status: "ok", expires_at: null, user_id: null, detail: null };
  try {
    const cc = await import(
      pathToFileURL(path.join(repoRoot, "packages/cloud-client/src/index.ts")).href
    ).catch(async () =>
      import(
        pathToFileURL(path.join(repoRoot, "packages/cloud-client/dist/index.js")).href
      ),
    );
    const initial = await cc.introspectBundle();
    if (!initial.ok && initial.reason === "no_bundle") {
      result.status = "no_bundle";
      return result;
    }
    if (initial.ok && initial.bundle) {
      const now = Math.floor(Date.now() / 1000);
      result.expires_at = initial.bundle.access_token_expires_at;
      result.user_id = initial.bundle.user_id;
      if (initial.bundle.access_token_expires_at - now <= TOKEN_REFRESH_THRESHOLD_SEC) {
        try {
          await cc.getValidAccessToken();
          const refreshed = await cc.readBundle();
          result.status = "refreshed";
          if (refreshed) result.expires_at = refreshed.access_token_expires_at;
        } catch (err) {
          result.status = "refresh_failed";
          result.detail = err instanceof Error ? err.message : String(err);
        }
      }
      return result;
    }
    if (initial.reason === "expired" && initial.bundle) {
      try {
        await cc.getValidAccessToken();
        const refreshed = await cc.readBundle();
        result.status = "refreshed";
        if (refreshed) {
          result.expires_at = refreshed.access_token_expires_at;
          result.user_id = refreshed.user_id;
        }
      } catch (err) {
        result.status = "refresh_failed";
        result.detail = err instanceof Error ? err.message : String(err);
      }
      return result;
    }
    result.status = "refresh_failed";
    result.detail = initial.reason ?? "unknown";
    return result;
  } catch (err) {
    result.status = "refresh_failed";
    result.detail = err instanceof Error ? err.message : String(err);
    return result;
  }
}

async function checkGit(repoRoot) {
  const result = {
    status: "up_to_date",
    current_sha: null,
    remote_sha: null,
    commits_pulled: 0,
    files_changed: [],
    restart_needed: [],
    detail: null,
  };
  try {
    await fs.access(path.join(repoRoot, ".git"));
  } catch {
    result.status = "no_repo";
    return result;
  }
  const head = await spawnCapture("git", ["rev-parse", "HEAD"], { cwd: repoRoot });
  result.current_sha = head.stdout.trim();

  const fetch = await spawnCapture("git", ["fetch", "origin"], { cwd: repoRoot });
  if (fetch.code !== 0) {
    result.status = "fetch_failed";
    result.detail = fetch.stderr.slice(0, 500);
    return result;
  }
  const remote = await spawnCapture("git", ["rev-parse", "origin/main"], { cwd: repoRoot });
  result.remote_sha = remote.stdout.trim();

  const dirty = await spawnCapture("git", ["status", "--porcelain"], { cwd: repoRoot });
  if (dirty.stdout.trim().length > 0) {
    result.status = "dirty_tree";
    result.detail = "Working tree has uncommitted changes; refusing to pull";
    return result;
  }
  const behind = await spawnCapture(
    "git",
    ["rev-list", "HEAD..origin/main", "--count"],
    { cwd: repoRoot },
  );
  const commitsBehind = parseInt(behind.stdout.trim(), 10) || 0;
  if (commitsBehind === 0) return result;

  // Capture file diff for restart-needed detection BEFORE pulling.
  const diff = await spawnCapture(
    "git",
    ["diff", "--name-only", "HEAD", "origin/main"],
    { cwd: repoRoot },
  );
  const files = diff.stdout.trim().split("\n").filter(Boolean);
  result.files_changed = files;

  const restartTriggers = [
    "packages/op-omega-server/",
    "packages/mock-core/",
    "packages/inference-server/",
    "packages/paperclip-plugin-wavex/",
  ];
  const restartMap = {
    "packages/op-omega-server/": "op_omega_server",
    "packages/mock-core/": "mock_core",
    "packages/inference-server/": "inference_server",
    "packages/paperclip-plugin-wavex/": "paperclip",
  };
  for (const trigger of restartTriggers) {
    if (files.some((f) => f.startsWith(trigger))) {
      result.restart_needed.push(restartMap[trigger]);
    }
  }

  const pull = await spawnCapture("git", ["pull", "--ff-only"], { cwd: repoRoot });
  if (pull.code !== 0) {
    result.status = "fetch_failed";
    result.detail = `ff-only pull failed: ${pull.stderr.slice(0, 500)}`;
    return result;
  }
  result.status = "updated";
  result.commits_pulled = commitsBehind;
  return result;
}

async function runInstallAndBuild(repoRoot, didGitUpdate) {
  const install = { status: "skipped", duration_ms: 0, detail: null };
  const build = { status: "skipped", packages_rebuilt: [], detail: null };
  if (!didGitUpdate) return { install, build };

  const t0 = Date.now();
  const inst = await spawnCapture("pnpm", ["install"], { cwd: repoRoot });
  install.duration_ms = Date.now() - t0;
  if (inst.code !== 0) {
    install.status = "failed";
    install.detail = inst.stderr.slice(0, 500);
    return { install, build };
  }
  install.status = "ok";

  const b = await spawnCapture(
    "pnpm",
    ["-r", "--filter", "@wavex-os/*", "build"],
    { cwd: repoRoot },
  );
  if (b.code !== 0) {
    build.status = "failed";
    build.detail = b.stderr.slice(0, 500);
  } else {
    build.status = "ok";
    // Best-effort parse for which packages built. pnpm prints
    // ".../packages/<name> build$" lines.
    const lines = b.stdout.split("\n");
    for (const line of lines) {
      const m = line.match(/packages\/([a-z0-9-]+)\s+build/);
      if (m) build.packages_rebuilt.push(`@wavex-os/${m[1]}`);
    }
  }
  return { install, build };
}

async function checkProcesses(restartNeeded) {
  const result = {
    status: "ok",
    mock_core: "unknown",
    op_omega_server: "unknown",
    paperclip: "unknown",
    restarted: [],
    detail: null,
  };
  for (const [name, port] of Object.entries(PROCESS_PORTS)) {
    const alive = await portOpen(port);
    result[name] = alive ? "alive" : "dead";
  }
  const dead = Object.keys(PROCESS_PORTS).filter((n) => result[n] === "dead");
  const toRestart = new Set([...dead, ...restartNeeded]);
  if (toRestart.size === 0) return result;

  for (const name of toRestart) {
    if (!IS_WIN && PROCESS_LAUNCHD_LABEL[name]) {
      const r = await spawnCapture("launchctl", [
        "kickstart",
        "-k",
        `gui/${process.getuid?.() ?? 501}/${PROCESS_LAUNCHD_LABEL[name]}`,
      ]);
      if (r.code === 0) result.restarted.push(name);
    }
  }
  if (dead.length > 0 && result.restarted.length < dead.length) {
    result.status = "some_dead";
    result.detail = `Dead: ${dead.join(", ")}; restarted: ${result.restarted.join(", ") || "none"}`;
  }
  return result;
}

async function checkBuildStaleness(repoRoot) {
  // Walk packages/@wavex-os/* — but here packages are under packages/<name>.
  // We look for src/*.ts newer than dist/*.js.
  const out = { status: "skipped", packages_rebuilt: [], detail: null };
  let pkgs;
  try {
    pkgs = await fs.readdir(path.join(repoRoot, "packages"));
  } catch (err) {
    out.detail = `packages dir missing: ${err.message}`;
    return out;
  }
  const stale = [];
  for (const name of pkgs) {
    const pkgDir = path.join(repoRoot, "packages", name);
    const srcDir = path.join(pkgDir, "src");
    const distDir = path.join(pkgDir, "dist");
    // Only consider packages that actually have a `build` script defined.
    let hasBuild = false;
    try {
      const pkgJson = JSON.parse(
        await fs.readFile(path.join(pkgDir, "package.json"), "utf8"),
      );
      hasBuild = Boolean(pkgJson.scripts?.build);
    } catch {
      continue;
    }
    if (!hasBuild) continue;
    try {
      const [srcLatest, distLatest] = await Promise.all([
        latestMtime(srcDir, /\.ts$/),
        latestMtime(distDir, /\.js$/),
      ]);
      if (srcLatest && distLatest && srcLatest > distLatest) stale.push(name);
    } catch {
      // ignore individual package errors
    }
  }
  if (stale.length === 0) return out;
  const r = await spawnCapture(
    "pnpm",
    ["-r", ...stale.flatMap((s) => ["--filter", `@wavex-os/${s}`]), "build"],
    { cwd: repoRoot },
  );
  if (r.code === 0) {
    out.status = "ok";
    out.packages_rebuilt = stale.map((s) => `@wavex-os/${s}`);
  } else {
    out.status = "failed";
    out.detail = (r.stderr || r.stdout || "pnpm build exited non-zero").slice(0, 500);
  }
  return out;
}

async function latestMtime(dir, re) {
  let max = 0;
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        const sub = await latestMtime(full, re);
        if (sub > max) max = sub;
      } else if (re.test(e.name)) {
        const st = await fs.stat(full);
        if (st.mtimeMs > max) max = st.mtimeMs;
      }
    }
  } catch {
    return 0;
  }
  return max;
}

function deriveUserAction(checks) {
  if (checks.git.status === "dirty_tree") {
    return {
      reason: "dirty_tree",
      button_label: "Discard local changes",
      detail:
        "Your wavex-os repo has uncommitted local changes. Auto-update is paused. Click to discard and resume.",
    };
  }
  if (checks.token.status === "refresh_failed") {
    return {
      reason: "refresh_failed",
      button_label: "Reconnect device",
      detail:
        checks.token.detail ??
        "Your device credentials could not be refreshed. Click to re-link this machine.",
    };
  }
  if (checks.git.status === "fetch_failed" && checks.git.detail?.includes("ff-only")) {
    return {
      reason: "merge_conflict",
      button_label: "Refresh page",
      detail: "Local repo diverged from origin/main and cannot fast-forward.",
    };
  }
  if (checks.processes.status === "some_dead" && checks.processes.restarted.length === 0) {
    return {
      reason: "manual_restart",
      button_label: "Click to start dev server",
      detail: checks.processes.detail ?? "One or more dev servers are not running.",
    };
  }
  return null;
}

// ---------- cloud push ----------

async function readDeviceBundle() {
  try {
    const raw = await fs.readFile(DEVICE_TOKEN_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function readLastPush() {
  try {
    const raw = await fs.readFile(CLOUD_PUSH_LAST_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function stateFingerprint(state) {
  // Cheap content hash: stringify just the fields the operator UI cares about.
  // If checks + requires_user_action are unchanged, we skip pushing (unless
  // the heartbeat window has elapsed).
  return JSON.stringify({
    checks: state.checks,
    requires_user_action: state.requires_user_action,
  });
}

async function pushStateToCloud(state) {
  const bundle = await readDeviceBundle();
  if (!bundle?.access_token) {
    return { status: "skipped", detail: "no_bundle" };
  }

  const last = await readLastPush();
  const fp = stateFingerprint(state);
  const now = Math.floor(Date.now() / 1000);
  const ageSec = last?.pushed_at ? now - last.pushed_at : Infinity;
  if (last?.fingerprint === fp && ageSec < CLOUD_PUSH_MIN_INTERVAL_SEC) {
    return { status: "skipped", detail: "unchanged_within_heartbeat" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLOUD_PUSH_TIMEOUT_MS);
  try {
    const res = await fetch(CLOUD_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        device_jwt: bundle.access_token,
        state_file_content: state,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const text = await res.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { status: "failed", detail: `non_json_response: ${text.slice(0, 200)}` };
    }
    if (parsed?.ok) {
      await atomicWriteJson(CLOUD_PUSH_LAST_FILE, {
        fingerprint: fp,
        pushed_at: now,
        inserted_id: parsed.inserted_id ?? null,
      });
      return {
        status: "ok",
        detail: null,
        inserted_id: parsed.inserted_id ?? null,
        fleet_status: parsed.fleet_status ?? null,
      };
    }
    return {
      status: "failed",
      detail: parsed?.error ? `${parsed.error}${parsed.reason ? `: ${parsed.reason}` : ""}` : "unknown",
    };
  } catch (err) {
    clearTimeout(timer);
    return {
      status: "failed",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------- main ----------

async function main() {
  const t0 = Date.now();
  const repoRoot = await findRepoRoot();

  const checks = {
    token: { status: "ok", expires_at: null, user_id: null, detail: null },
    git: {
      status: "up_to_date",
      current_sha: null,
      remote_sha: null,
      commits_pulled: 0,
      files_changed: [],
      restart_needed: [],
      detail: null,
    },
    install: { status: "skipped", duration_ms: 0, detail: null },
    build: { status: "skipped", packages_rebuilt: [], detail: null },
    processes: {
      status: "ok",
      mock_core: "unknown",
      op_omega_server: "unknown",
      paperclip: "unknown",
      restarted: [],
      detail: null,
    },
  };

  try {
    checks.token = await checkToken(repoRoot);
  } catch (err) {
    checks.token = {
      status: "refresh_failed",
      expires_at: null,
      user_id: null,
      detail: err instanceof Error ? err.message : String(err),
    };
  }

  try {
    checks.git = await checkGit(repoRoot);
  } catch (err) {
    checks.git.status = "fetch_failed";
    checks.git.detail = err instanceof Error ? err.message : String(err);
  }

  const didGitUpdate = checks.git.status === "updated";
  try {
    const ib = await runInstallAndBuild(repoRoot, didGitUpdate);
    checks.install = ib.install;
    checks.build = ib.build;
  } catch (err) {
    checks.install.status = "failed";
    checks.install.detail = err instanceof Error ? err.message : String(err);
  }

  try {
    checks.processes = await checkProcesses(checks.git.restart_needed);
  } catch (err) {
    checks.processes.detail = err instanceof Error ? err.message : String(err);
  }

  // Build-staleness only runs if we didn't already build everything.
  if (!didGitUpdate) {
    try {
      const stale = await checkBuildStaleness(repoRoot);
      if (stale.status === "ok") {
        checks.build = {
          status: "ok",
          packages_rebuilt: stale.packages_rebuilt,
          detail: "rebuilt stale packages",
        };
      } else if (stale.status === "failed") {
        checks.build = { status: "failed", packages_rebuilt: [], detail: stale.detail };
      }
    } catch (err) {
      checks.build.status = "failed";
      checks.build.detail = err instanceof Error ? err.message : String(err);
    }
  }

  const ranAt = Math.floor(Date.now() / 1000);
  const state = {
    schema_version: SCHEMA_VERSION,
    ran_at: ranAt,
    ran_at_iso: new Date(ranAt * 1000).toISOString(),
    next_run_at: ranAt + CYCLE_INTERVAL_SEC,
    cycle_duration_ms: Date.now() - t0,
    checks,
    requires_user_action: deriveUserAction(checks),
  };

  // Push to cloud so Mission Control admin fleet can see this customer's
  // installation in real time. Fire-and-forget: a failed push never crashes
  // the cycle, but we record the outcome on the state object so the operator
  // UI can see whether cloud is in sync. Note: we run the push BEFORE writing
  // the state file so cloud_push is part of the persisted state.
  let cloud_push;
  try {
    cloud_push = await pushStateToCloud(state);
  } catch (err) {
    cloud_push = {
      status: "failed",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
  state.cloud_push = cloud_push;

  await atomicWriteJson(STATE_FILE, state);
  console.log(
    `[wavex-local-ops] cycle ok in ${state.cycle_duration_ms}ms → ${STATE_FILE}` +
      ` (cloud_push=${cloud_push.status}${cloud_push.detail ? `: ${cloud_push.detail}` : ""})`,
  );

  // Fire-and-forget Claude Doctor when the cycle leaves things in a state
  // Claude Code can plausibly fix (build_failed, install_failed, dead
  // processes, postgres-lock noise). The doctor runs with its own cooldown
  // + lockfile — it'll no-op if nothing's broken or if a run is already
  // in flight. Daemon never blocks on it.
  if (process.env.WAVEX_CLAUDE_DOCTOR_DISABLED !== "1") {
    const doctorScript = path.join(repoRoot, "scripts/wavex-claude-doctor.mjs");
    try {
      await fs.access(doctorScript);
      const child = spawn(process.execPath, [doctorScript], {
        detached: true,
        stdio: "ignore",
        env: process.env,
      });
      child.unref();
    } catch {
      // Script missing on older customer installs — silently skip.
    }
  }

  process.exit(0);
}

main().catch((err) => {
  // Last-resort fallback: write a minimal error state and exit 0 so launchd
  // doesn't back off our cadence.
  const ranAt = Math.floor(Date.now() / 1000);
  const fallback = {
    schema_version: SCHEMA_VERSION,
    ran_at: ranAt,
    ran_at_iso: new Date(ranAt * 1000).toISOString(),
    next_run_at: ranAt + CYCLE_INTERVAL_SEC,
    cycle_duration_ms: 0,
    checks: null,
    requires_user_action: {
      reason: "manual_restart",
      button_label: "Refresh page",
      detail: err instanceof Error ? err.message : String(err),
    },
  };
  atomicWriteJson(STATE_FILE, fallback).finally(() => {
    console.error("[wavex-local-ops] fatal:", err);
    process.exit(0);
  });
});
