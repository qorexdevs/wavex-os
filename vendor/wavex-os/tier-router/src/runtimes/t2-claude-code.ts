/**
 * T2 runtime · Claude Code CLI subprocess.
 *
 * Spawns `claude -p <prompt> --output-format <fmt>` and captures stdout.
 * Routes through the operator's Max subscription — same billing path as
 * Paperclip's claude_local adapter (`billingType: subscription_included`).
 *
 * Cost of this call in dollars is $0 on the Max plan; we still report the
 * tokens if the CLI returned them in JSON mode.
 */

import { spawn } from "node:child_process";

export interface ClaudeInvokeInput {
  /** Path or name of the claude CLI binary. */
  bin: string;
  prompt: string;
  outputFormat: "text" | "json";
  timeoutMs: number;
}

export interface ClaudeInvokeResult {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  costUsd?: number;
  billingType?: string;
}

export async function invokeClaudeCode(input: ClaudeInvokeInput): Promise<ClaudeInvokeResult> {
  const args = ["-p", input.prompt];
  if (input.outputFormat === "json") {
    args.push("--output-format", "json");
  }
  return new Promise((resolve, reject) => {
    const proc = spawn(input.bin, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    let stdout = "";
    let stderr = "";
    const killer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error(`claude -p timed out after ${input.timeoutMs}ms`));
    }, input.timeoutMs);

    proc.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    proc.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    proc.on("error", (err) => {
      clearTimeout(killer);
      reject(err);
    });
    proc.on("close", (code) => {
      clearTimeout(killer);
      if (code !== 0) {
        reject(new Error(`claude -p exited ${code}: ${stderr.slice(0, 400)}`));
        return;
      }
      if (input.outputFormat === "json") {
        try {
          const parsed = JSON.parse(stdout) as {
            result?: string;
            total_cost_usd?: number;
            usage?: {
              input_tokens?: number;
              output_tokens?: number;
              cache_read_input_tokens?: number;
            };
          };
          resolve({
            text: typeof parsed.result === "string" ? parsed.result : stdout,
            inputTokens: parsed.usage?.input_tokens,
            outputTokens: parsed.usage?.output_tokens,
            cachedInputTokens: parsed.usage?.cache_read_input_tokens,
            costUsd: parsed.total_cost_usd,
            billingType: "subscription_included",
          });
          return;
        } catch {
          // fall through and return raw stdout as text
        }
      }
      resolve({
        text: stdout,
        billingType: "subscription_included",
      });
    });
  });
}
