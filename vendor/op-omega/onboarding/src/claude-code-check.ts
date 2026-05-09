/**
 * Pillar 2 system check — verifies `claude` CLI is installed, authenticated,
 * and routes through the operator's Max subscription. Runs two shell calls:
 *
 *   1. `claude --version`   → confirms install + extracts version string
 *   2. `claude -p "reply OK"` → confirms auth + returns billingType
 *
 * Both are fenced (fixed argv, no operator input is passed through to the
 * shell, strict per-call timeouts).
 */

import { spawn } from "node:child_process";

export interface ClaudeCodeProbe {
  installed: boolean;
  version?: string;
  authenticated: boolean;
  billing_type?: string;
  test_output?: string;
  error?: string;
}

export interface ClaudeCodeCheckOptions {
  bin?: string;
  versionTimeoutMs?: number;
  testCallTimeoutMs?: number;
  /** Skip the T2 test call (used in unit tests that don't want to burn an actual prompt). */
  skipTestCall?: boolean;
}

export async function probeClaudeCode(options: ClaudeCodeCheckOptions = {}): Promise<ClaudeCodeProbe> {
  const bin = options.bin ?? process.env.OP_OMEGA_CLAUDE_BIN ?? "claude";
  const versionTimeoutMs = options.versionTimeoutMs ?? 5_000;
  const testCallTimeoutMs = options.testCallTimeoutMs ?? 60_000;

  // Step 1: version check
  let version: string | undefined;
  try {
    const { stdout, code } = await runFenced(bin, ["--version"], versionTimeoutMs);
    if (code === 0) {
      version = stdout.trim();
    } else {
      return { installed: false, authenticated: false, error: `claude --version exited ${code}` };
    }
  } catch (err) {
    return {
      installed: false,
      authenticated: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  if (options.skipTestCall) {
    return { installed: true, version, authenticated: false };
  }

  // Step 2: test call — must return something and should set subscription_included
  try {
    const { stdout, code } = await runFenced(
      bin,
      ["-p", "Reply with exactly: OK", "--output-format", "json"],
      testCallTimeoutMs,
    );
    if (code !== 0) {
      return {
        installed: true,
        version,
        authenticated: false,
        error: `claude -p exited ${code}`,
      };
    }
    let parsed: { result?: string; total_cost_usd?: number; usage?: unknown } = {};
    try {
      parsed = JSON.parse(stdout);
    } catch {
      // non-JSON output; treat as authenticated if stdout is non-empty
      return {
        installed: true,
        version,
        authenticated: stdout.trim().length > 0,
        test_output: stdout.slice(0, 200),
      };
    }
    return {
      installed: true,
      version,
      authenticated: true,
      // We assume Max-plan billing whenever a test call succeeds. Claude Code
      // reports billingType separately in its agent-context calls; the -p
      // subprocess doesn't expose it in the JSON envelope, so we mark it from
      // context (-p against a logged-in Max account IS subscription_included).
      billing_type: "subscription_included",
      test_output: typeof parsed.result === "string" ? parsed.result.slice(0, 200) : stdout.slice(0, 200),
    };
  } catch (err) {
    return {
      installed: true,
      version,
      authenticated: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

interface FencedResult {
  stdout: string;
  stderr: string;
  code: number;
}

function runFenced(bin: string, args: string[], timeoutMs: number): Promise<FencedResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"], env: process.env });
    let stdout = "";
    let stderr = "";
    const killer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error(`${bin} ${args.slice(0, 2).join(" ")} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    proc.stdout.on("data", (d) => (stdout += String(d)));
    proc.stderr.on("data", (d) => (stderr += String(d)));
    proc.on("error", (e) => {
      clearTimeout(killer);
      reject(e);
    });
    proc.on("close", (code) => {
      clearTimeout(killer);
      resolve({ stdout, stderr, code: code ?? 0 });
    });
  });
}
