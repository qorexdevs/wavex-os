/**
 * Operator Ω · tier-router public types (OPΩ-SPEC §5.2).
 */

export type Tier = 0 | 1 | 2;
export type TierRuntime = "typescript" | "python" | "ollama" | "claude-code" | "claude-api-overflow";
export type TaskPriority = "critical" | "high" | "normal" | "batch";
export type ReasoningDepth = "none" | "shallow" | "deep";

export interface TaskMetadata {
  creativity_required: boolean;
  customer_facing: boolean;
  reasoning_depth: ReasoningDepth;
  max_latency_ms?: number;
  priority?: TaskPriority;
}

export interface TierRoutingRequest {
  agent_id: string;
  task_metadata: TaskMetadata;
  prompt: string;
  /** Optional structured context the caller wants the runtime to see. */
  context?: Record<string, unknown>;
  /** Used to look up rate-limit-budget state before T2. Required for enforcement. */
  companyId?: string;
  /** For T0 — caller may pass a deterministic function to run when routed to T0. */
  t0Handler?: (request: TierRoutingRequest) => Promise<string> | string;
  /** T2 output format hint. "json" attempts JSON mode (Claude Code --output-format json). */
  outputFormat?: "text" | "json";
  /** Override per-request timeout in ms. Default 60_000. */
  timeout_ms?: number;
}

export interface TierRoutingCost {
  usd: number;
  tokens?: number;
  window_consumed_pct?: number;
}

export interface TierRoutingResponse {
  tier: Tier;
  runtime: TierRuntime;
  output: string;
  cost: TierRoutingCost;
  trace_id: string;
  /** Ms wall-clock for the inference call itself. */
  duration_ms: number;
  /** Non-fatal warnings (e.g. Ollama unreachable → fell back to T2). */
  warnings?: string[];
  /** Set when the router deferred the request (no tier could run under current budget). */
  deferred?: {
    reason: string;
    retry_after_ms: number;
  };
}

export interface BudgetSnapshot {
  claude5hPctUsed: number;
  claudeWeeklyPctUsed: number;
  canRouteT2: boolean;
  canOverflow: boolean;
  apiOverflowMonthlyRemainingUsd: number;
  recommendation: "ok" | "throttle" | "defer_non_critical" | "halt";
}

export interface TierRouterOptions {
  /** Override Ollama base URL. Default http://127.0.0.1:11434. */
  ollamaBaseUrl?: string;
  /** Ollama model name. Default "llama3.2:3b". */
  ollamaModel?: string;
  /** Base URL for the Paperclip server (for budget plugin bridge). */
  paperclipBaseUrl?: string;
  /** claude CLI binary path. Default "claude". */
  claudeBin?: string;
}
