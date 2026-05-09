/**
 * Layer 3 of the self-healing architecture: worker restart with proper
 * SIGTERM → wait → SIGKILL → retry-hook.
 *
 * Reference implementation. The orchestrator's maintenance UI calls this
 * (gated behind a board-admin permission check) when the user clicks
 * "Reboot workers" — typically because a fleet-wide 401 storm has left
 * workers stuck on bad auth.
 *
 * Pre-flight invariant: the caller MUST refuse to restart workers when
 * OAuth status is `expired` AND the caller hasn't explicitly opted into
 * `force_through_bad_auth`. Restarting workers with bad auth just spawns
 * more 401-failures in a tight loop — that's the failure mode this exists
 * to fix. Always try Layer 2 (oauth-refresh) first, then restart.
 */

import { execFile as execFileCb, spawn } from "node:child_process";
import { promisify } from "node:util";
const execFile = promisify(execFileCb);

const SIGTERM_GRACE_MS = 10_000;
const PGREP_TIMEOUT_MS = 5_000;
const RETRY_HOOK_TIMEOUT_MS = 60_000;

export type WorkerInfo = {
  pid: number;
  cmd: string;
  startedAt: number | null;
};

/**
 * Discover live `claude --print` workers spawned by the orchestrator.
 * On macOS BSD pgrep, `-lf` shows the full command line; Linux uses `-af`.
 */
export async function listClaudeWorkers(opts: { matchPattern?: string } = {}): Promise<WorkerInfo[]> {
  const pattern = opts.matchPattern ?? "claude --print";
  const flags = process.platform === "darwin" ? "-lf" : "-af";
  try {
    const { stdout } = await execFile("pgrep", [flags, pattern], {
      timeout: PGREP_TIMEOUT_MS,
    });
    return stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [pidStr, ...cmdParts] = line.trim().split(/\s+/);
        return {
          pid: Number(pidStr),
          cmd: cmdParts.join(" "),
          startedAt: null,
        };
      })
      .filter((w) => Number.isFinite(w.pid) && w.pid > 0);
  } catch {
    // pgrep returns non-zero exit when no matches — that's not an error
    // for our purposes.
    return [];
  }
}

/**
 * SIGTERM, wait for grace, SIGKILL stragglers. Returns counts of each
 * outcome so the caller can report them in a Telegram receipt.
 */
export async function killWorkers(pids: number[]): Promise<{
  killed: number;
  killed_pids: number[];
  not_found: number[];
}> {
  if (pids.length === 0) return { killed: 0, killed_pids: [], not_found: [] };

  const killed: number[] = [];
  const not_found: number[] = [];

  // Send SIGTERM to all targets in parallel.
  for (const pid of pids) {
    try {
      process.kill(pid, "SIGTERM");
      killed.push(pid);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ESRCH") not_found.push(pid);
      else not_found.push(pid); // EPERM also counts as "we can't touch this"
    }
  }

  if (killed.length === 0) {
    return { killed: 0, killed_pids: [], not_found };
  }

  // Wait the grace period.
  await new Promise((r) => setTimeout(r, SIGTERM_GRACE_MS));

  // Anything still alive gets SIGKILL.
  for (const pid of killed) {
    try {
      process.kill(pid, 0); // signal 0 = existence check
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // already gone — fine
      }
    } catch {
      // already gone — fine
    }
  }

  return { killed: killed.length, killed_pids: killed, not_found };
}

/**
 * After workers are killed, run the orchestrator's retry hook to re-queue
 * any tasks whose runs were aborted. The hook is platform-specific — pass
 * the full command + args you want spawned (e.g. ["node", "noop-detector.mjs", "--retry"]).
 *
 * The hook is allowed to write to stdout/stderr; we collect them and
 * surface them in the return value so the maintenance UI can display the
 * outcome.
 */
export async function runRetryHook(opts: {
  command: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}): Promise<{
  retried: number;
  failures: number;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  error?: string;
}> {
  return new Promise((resolve) => {
    const child = spawn(opts.command, opts.args, {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({
        retried: 0,
        failures: 0,
        exitCode: null,
        stdout,
        stderr,
        error: `retry hook timed out after ${RETRY_HOOK_TIMEOUT_MS}ms`,
      });
    }, RETRY_HOOK_TIMEOUT_MS);

    child.stdout.on("data", (b) => {
      stdout += b.toString();
    });
    child.stderr.on("data", (b) => {
      stderr += b.toString();
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      // The hook is expected to print a final JSON line of the form
      // {"retried": N, "failures": M}. Parse the last such line if present.
      let retried = 0;
      let failures = 0;
      const lines = stdout.split("\n").filter(Boolean);
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const parsed = JSON.parse(lines[i]) as {
            retried?: number;
            failures?: number;
          };
          if (typeof parsed.retried === "number") retried = parsed.retried;
          if (typeof parsed.failures === "number") failures = parsed.failures;
          if (parsed.retried !== undefined || parsed.failures !== undefined) break;
        } catch {
          // not JSON — keep scanning back
        }
      }
      resolve({
        retried,
        failures,
        exitCode: code,
        stdout,
        stderr,
      });
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({
        retried: 0,
        failures: 0,
        exitCode: null,
        stdout,
        stderr,
        error: err.message,
      });
    });
  });
}
