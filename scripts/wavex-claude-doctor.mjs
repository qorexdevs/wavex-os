#!/usr/bin/env node
/**
 * WaveX Claude Doctor — the "magical autonomous self-fix" entrypoint.
 *
 * Reads the local-ops state file, decides if anything Claude Code can
 * meaningfully fix is broken, makes sure the claude-code-proxy is up
 * (since we route inference through it), and then spawns Claude Code
 * with a diagnostic prompt that names the broken state + tells it what
 * files/commands it can read/run.
 *
 * Claude Code has full tool access on the customer's machine (file_read,
 * bash, etc.) — it figures out the fix interactively. We just plant the
 * seed.
 *
 * Invocation:
 *   Normally spawned by `wavex-local-ops-cycle.mjs` when it detects an
 *   auto-fixable degraded state. Can also be run manually:
 *     node scripts/wavex-claude-doctor.mjs
 *
 * Constraints:
 *   - Exits 0 on success OR no-op (so the daemon doesn't back off cadence).
 *   - File-locks at ~/.wavex-os/.claude-doctor.lock so two cycles can't
 *     race claude into the same fix.
 *   - Captures Claude Code's full output to ~/.wavex-os/state/claude-doctor.log
 *     (appended; never cleaned — operator policy: logs are training data).
 *   - Records a structured run summary into local-ops-state.json under
 *     `claude_doctor` so Mission Control sees what was attempted.
 *
 * Environment:
 *   WAVEX_CLAUDE_BIN        path to the claude CLI; default just `claude`
 *                           (must be on PATH)
 *   WAVEX_PROXY_URL         where to point ANTHROPIC_BASE_URL; default
 *                           http://127.0.0.1:11434
 *   WAVEX_CLAUDE_DOCTOR_DISABLED=1   skip entirely (kill switch)
 *   WAVEX_CLAUDE_DOCTOR_TIMEOUT_MS   max claude runtime; default 5 min
 *   WAVEX_CLAUDE_DOCTOR_FORCE=1      skip the lockfile + cooldown check
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { homedir, platform } from "node:os";
import { spawn } from "node:child_process";
import net from "node:net";

const STATE_DIR = path.join(homedir(), ".wavex-os");
const STATE_FILE = path.join(STATE_DIR, "local-ops-state.json");
const LOCK_FILE = path.join(STATE_DIR, ".claude-doctor.lock");
const LOG_FILE = path.join(STATE_DIR, "state", "claude-doctor.log");
const COOLDOWN_FILE = path.join(STATE_DIR, "claude-doctor-last.json");
const COOLDOWN_SEC = 15 * 60; // don't re-invoke more than once per 15 min
const PROXY_URL = process.env.WAVEX_PROXY_URL ?? "http://127.0.0.1:11434";
const PROXY_PORT = (() => {
  try { return Number(new URL(PROXY_URL).port || "11434"); }
  catch { return 11434; }
})();
const CLAUDE_BIN = process.env.WAVEX_CLAUDE_BIN ?? "claude";
const TIMEOUT_MS = Number(process.env.WAVEX_CLAUDE_DOCTOR_TIMEOUT_MS ?? 5 * 60_000);
const IS_WIN = platform() === "win32";

// ---------- small utilities ----------

function nowSec() { return Math.floor(Date.now() / 1000); }

function spawnCaptureWithLog(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { ...opts, shell: IS_WIN });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d) => { stdout += d.toString(); });
    child.stderr?.on("data", (d) => { stderr += d.toString(); });
    const timer = setTimeout(() => {
      try { child.kill("SIGTERM"); } catch { /* ignore */ }
      setTimeout(() => { try { child.kill("SIGKILL"); } catch { /* ignore */ } }, 5_000);
    }, TIMEOUT_MS);
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: String(err), timed_out: false });
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({
        code: code ?? -1,
        stdout,
        stderr,
        timed_out: signal === "SIGTERM" || signal === "SIGKILL",
      });
    });
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

async function appendLog(line) {
  await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
  await fs.appendFile(LOG_FILE, `[${new Date().toISOString()}] ${line}\n`, "utf8");
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, filePath);
}

// ---------- decision logic ----------

/** Should Claude Doctor try to fix this state, or is it a no-op? */
function shouldInvoke(state) {
  if (!state || !state.checks) return { should: false, why: "no_state" };
  const c = state.checks;

  // Don't fight a user action that's already exposed as a button. The UI
  // will let the customer click "Discard local changes" or "Reconnect
  // device" — Claude shouldn't second-guess those.
  if (state.requires_user_action) {
    return { should: false, why: `user_action_pending:${state.requires_user_action.reason}` };
  }

  const reasons = [];

  // Build failure (e.g. tsx missing, tsc errors, broken peer deps)
  if (c.build?.status === "failed") {
    reasons.push("build_failed");
  }
  // Install failure
  if (c.install?.status === "failed") {
    reasons.push("install_failed");
  }
  // Dead processes that auto-restart didn't recover
  if (c.processes?.status === "some_dead" && (c.processes.restarted?.length ?? 0) === 0) {
    reasons.push("processes_dead");
  }
  // Generic upstream-resolution noise — we want Claude to inspect logs
  // and reason about them.
  if (c.processes?.detail?.toLowerCase().includes("postgres") ||
      c.processes?.detail?.toLowerCase().includes("port already")) {
    reasons.push("postgres_lock_or_port");
  }

  if (reasons.length === 0) return { should: false, why: "nothing_broken" };
  return { should: true, why: reasons.join(",") };
}

/** Have we recently invoked? Cooldown prevents runaway loops. */
async function withinCooldown() {
  if (process.env.WAVEX_CLAUDE_DOCTOR_FORCE === "1") return false;
  try {
    const raw = await fs.readFile(COOLDOWN_FILE, "utf8");
    const last = JSON.parse(raw);
    if (typeof last.ran_at !== "number") return false;
    return nowSec() - last.ran_at < COOLDOWN_SEC;
  } catch {
    return false;
  }
}

async function acquireLock() {
  if (process.env.WAVEX_CLAUDE_DOCTOR_FORCE === "1") return true;
  try {
    // O_EXCL — fails if exists.
    const fh = await fs.open(LOCK_FILE, "wx");
    await fh.writeFile(JSON.stringify({ pid: process.pid, ran_at: nowSec() }));
    await fh.close();
    return true;
  } catch {
    // Lock exists. Check staleness — older than 10 min → assume crashed,
    // steal the lock.
    try {
      const st = await fs.stat(LOCK_FILE);
      const ageSec = (Date.now() - st.mtimeMs) / 1000;
      if (ageSec > 10 * 60) {
        await fs.unlink(LOCK_FILE).catch(() => {});
        return acquireLock();
      }
    } catch { /* ignore */ }
    return false;
  }
}

async function releaseLock() {
  try { await fs.unlink(LOCK_FILE); } catch { /* ignore */ }
}

// ---------- prompt builder ----------

function buildPrompt(state, reasons) {
  const c = state.checks ?? {};
  const recentErrors = [];
  if (c.token?.detail) recentErrors.push(`token: ${c.token.detail}`);
  if (c.git?.detail) recentErrors.push(`git: ${c.git.detail}`);
  if (c.install?.detail) recentErrors.push(`install: ${c.install.detail}`);
  if (c.build?.detail) recentErrors.push(`build: ${c.build.detail}`);
  if (c.processes?.detail) recentErrors.push(`processes: ${c.processes.detail}`);

  const portsHint = Object.entries({
    mock_core: c.processes?.mock_core,
    op_omega_server: c.processes?.op_omega_server,
    paperclip: c.processes?.paperclip,
  })
    .map(([k, v]) => `  ${k}: ${v ?? "unknown"}`)
    .join("\n");

  return `You are the WaveX OS local doctor. The daemon detected the following degraded state on THIS machine and is calling you to fix it autonomously. The customer is non-technical — they will not see your output. Fix the problem with the smallest set of changes possible. Do NOT ask the customer questions.

Reasons the daemon called you: ${reasons}

State file: ~/.wavex-os/local-ops-state.json (read this first for full structure)

Process health:
${portsHint}

Recent errors:
${recentErrors.length ? recentErrors.map((e) => `  - ${e}`).join("\n") : "  (none captured)"}

What you can do:
1. Read ~/.wavex-os/local-ops-state.json for full context.
2. Read any wavex-os logs under ~/.wavex-os/state/ (mock-core, paperclip, inference-server).
3. Read source files in the wavex-os repo (cwd should be the repo root or you can cd into it).
4. Run shell commands to inspect (lsof, ps, netstat, etc.) and to fix (taskkill / kill, pnpm install, etc.).
5. Common fixes you might apply:
   - Stale postgres "shared memory block still in use" → find + kill the orphan postgres process on Mac/Linux (\`pkill -f postgres\`) or Windows (\`taskkill /F /IM postgres.exe\`). Then restart the dev server.
   - "tsx not found" in @paperclipai/server → run \`pnpm install\` from the workspace root to re-hoist, OR run \`pnpm --filter @paperclipai/server install\` to install tsx into that specific workspace.
   - Build failure → read the failing file, check for syntax errors, run \`pnpm --filter <package> build\` again.
   - Stuck launchd/Scheduled Task job → \`launchctl kickstart\` (Mac) or restart Scheduled Task (Win).

What you must NOT do:
- DO NOT delete the device-token.json file or any file under ~/.wavex-os/state/.
- DO NOT modify files outside the wavex-os repo or ~/.wavex-os/.
- DO NOT make any git commits or push anything — fixes are local-only.
- DO NOT touch frozen paths (vendor/op-omega/, packages/healing/, packages/observability/src/, scripts/wrappers/, templates/launchd/).

When done:
- Print a single final line: "DOCTOR_RESULT: <fixed | partial | unable> — <one-sentence summary>"
- If you couldn't fix it, explain WHY so the operator can intervene.
- Exit. The daemon will pick up the new state on the next cycle.
`;
}

// ---------- main ----------

async function main() {
  if (process.env.WAVEX_CLAUDE_DOCTOR_DISABLED === "1") {
    console.log("[wavex-claude-doctor] disabled via WAVEX_CLAUDE_DOCTOR_DISABLED=1");
    return;
  }

  let state;
  try {
    state = JSON.parse(await fs.readFile(STATE_FILE, "utf8"));
  } catch (err) {
    await appendLog(`could not read state file: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }

  const decision = shouldInvoke(state);
  if (!decision.should) {
    await appendLog(`skip: ${decision.why}`);
    return;
  }

  if (await withinCooldown()) {
    await appendLog(`skip: within cooldown (last invocation < ${COOLDOWN_SEC}s ago)`);
    return;
  }

  if (!(await acquireLock())) {
    await appendLog("skip: another doctor run is in flight");
    return;
  }

  const startedAt = nowSec();
  await appendLog(`invoke begin: reasons=${decision.why}`);

  try {
    // Ensure the proxy is up — Claude Code needs ANTHROPIC_BASE_URL.
    const proxyAlive = await portOpen(PROXY_PORT);
    if (!proxyAlive) {
      await appendLog(`proxy is down on port ${PROXY_PORT}; doctor cannot run`);
      await writeDoctorState(state, {
        started_at: startedAt,
        finished_at: nowSec(),
        exit_code: -1,
        reasons: decision.why,
        outcome: "proxy_down",
        summary: `claude-code-proxy not responding on ${PROXY_URL} — Claude Code can't reach inference. Start the proxy first.`,
      });
      return;
    }

    const prompt = buildPrompt(state, decision.why);

    // Spawn Claude Code with the proxy as its API base. Use -p for
    // non-interactive mode + --dangerously-skip-permissions because we
    // trust this prompt and the daemon needs claude to run unattended.
    // The customer's local FS access is bounded by the prompt's "what
    // you must NOT do" rules.
    const env = {
      ...process.env,
      ANTHROPIC_BASE_URL: PROXY_URL,
      ANTHROPIC_API_KEY: "wavex-os-proxy-stub-key", // claude needs this set
    };
    const result = await spawnCaptureWithLog(
      CLAUDE_BIN,
      ["-p", prompt, "--dangerously-skip-permissions"],
      { env },
    );

    const finishedAt = nowSec();
    const resultLine = (result.stdout.split("\n").find((l) => l.startsWith("DOCTOR_RESULT:")) ?? "").trim();
    const outcome = result.timed_out
      ? "timeout"
      : result.code === 0
        ? "ok"
        : "claude_error";

    await appendLog(`invoke end: outcome=${outcome} exit=${result.code} timed_out=${result.timed_out}`);
    await appendLog(`stdout:\n${result.stdout}\n---`);
    if (result.stderr) await appendLog(`stderr:\n${result.stderr}\n---`);

    await writeJson(COOLDOWN_FILE, { ran_at: finishedAt });

    await writeDoctorState(state, {
      started_at: startedAt,
      finished_at: finishedAt,
      exit_code: result.code,
      reasons: decision.why,
      outcome,
      summary: resultLine || `claude exited code=${result.code}`,
    });
  } catch (err) {
    await appendLog(`fatal: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    await releaseLock();
  }
}

async function writeDoctorState(state, claudeResult) {
  // Merge into the existing state file under `claude_doctor`. Don't
  // change anything else — the daemon owns the rest of the schema.
  const merged = { ...state, claude_doctor: claudeResult };
  await writeJson(STATE_FILE, merged);
}

main().catch(async (err) => {
  await appendLog(`fatal in main(): ${err instanceof Error ? err.message : String(err)}`);
  process.exit(0); // always 0 so the daemon doesn't back off
});
