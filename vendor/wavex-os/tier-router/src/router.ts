/**
 * Operator Ω · tier-router core routing algorithm (OPΩ-SPEC §5.2).
 *
 * decide(request, budget) → { tier, reason } is pure and unit-testable.
 * route(request, opts)     → TierRoutingResponse is the full executor that
 *                             consults budget, picks a tier, invokes the
 *                             matching runtime, and returns a response.
 */

import { randomUUID } from "node:crypto";
import type {
  BudgetSnapshot,
  Tier,
  TierRoutingRequest,
  TierRoutingResponse,
  TierRouterOptions,
  TierRuntime,
} from "./types.js";
import { fetchBudgetSnapshot } from "./budget-client.js";
import { invokeOllama } from "./runtimes/t1-ollama.js";
import { invokeClaudeCode } from "./runtimes/t2-claude-code.js";

export interface RoutingDecision {
  tier: Tier;
  runtime: TierRuntime;
  reason: string;
  useOverflow?: boolean;
  deferred?: { reason: string; retry_after_ms: number };
}

const BUDGET_CRITICAL_HEADROOM_PCT = 20;

/**
 * Pure routing decision. No side effects. Used by `route()` and unit-tested
 * in router.test.ts.
 */
export function decide(request: TierRoutingRequest, budget: BudgetSnapshot): RoutingDecision {
  const m = request.task_metadata;
  const priority = m.priority ?? "normal";

  if (!m.creativity_required && m.reasoning_depth === "none") {
    return { tier: 0, runtime: "typescript", reason: "deterministic path (no creativity, no reasoning)" };
  }

  if (m.reasoning_depth === "shallow" && !m.customer_facing) {
    return { tier: 1, runtime: "ollama", reason: "shallow reasoning, non-customer-facing → T1" };
  }

  const remainingT2Pct = 100 - Math.max(budget.claude5hPctUsed, budget.claudeWeeklyPctUsed);
  if (budget.canRouteT2 && remainingT2Pct > BUDGET_CRITICAL_HEADROOM_PCT) {
    return { tier: 2, runtime: "claude-code", reason: `T2 within budget (${remainingT2Pct.toFixed(0)}% window left)` };
  }

  if (priority === "critical" && budget.canOverflow && budget.apiOverflowMonthlyRemainingUsd > 0) {
    return {
      tier: 2,
      runtime: "claude-api-overflow",
      useOverflow: true,
      reason: "critical priority + overflow budget available",
    };
  }

  if (budget.canRouteT2) {
    // Still within hard limit, just in the tight band (0-20% headroom); let non-critical requests go
    // but mark for potential deferral of next batch.
    if (priority === "critical" || priority === "high") {
      return { tier: 2, runtime: "claude-code", reason: "tight headroom but priority ≥ high" };
    }
    return {
      tier: 2,
      runtime: "claude-code",
      reason: "tight headroom, non-critical — running but recommendation is throttle",
    };
  }

  return {
    tier: 0,
    runtime: "typescript",
    reason: "T2 halted by budget and no overflow available",
    deferred: {
      reason: `T2 halted (${budget.recommendation}); retry after window reset`,
      retry_after_ms: 5 * 60 * 1000,
    },
  };
}

export async function route(
  request: TierRoutingRequest,
  options: TierRouterOptions = {},
): Promise<TierRoutingResponse> {
  const traceId = randomUUID();
  const started = Date.now();
  const warnings: string[] = [];

  const paperclipBaseUrl = options.paperclipBaseUrl ?? process.env.WAVEX_OS_PAPERCLIP_BASE_URL ?? "http://127.0.0.1:3102";

  let budget: BudgetSnapshot = {
    claude5hPctUsed: 0,
    claudeWeeklyPctUsed: 0,
    canRouteT2: true,
    canOverflow: false,
    apiOverflowMonthlyRemainingUsd: 0,
    recommendation: "ok",
  };

  if (request.companyId) {
    const snap = await fetchBudgetSnapshot(paperclipBaseUrl, request.companyId);
    budget = snap.snapshot;
    if (snap.warning) warnings.push(snap.warning);
  } else {
    warnings.push("no companyId supplied; budget enforcement skipped (permissive)");
  }

  const decision = decide(request, budget);

  if (decision.deferred) {
    return {
      tier: decision.tier,
      runtime: decision.runtime,
      output: "",
      cost: { usd: 0 },
      trace_id: traceId,
      duration_ms: Date.now() - started,
      warnings,
      deferred: decision.deferred,
    };
  }

  const timeoutMs = request.timeout_ms ?? 60_000;

  if (decision.tier === 0) {
    const handler = request.t0Handler;
    const output = handler ? await handler(request) : "";
    return {
      tier: 0,
      runtime: decision.runtime,
      output,
      cost: { usd: 0 },
      trace_id: traceId,
      duration_ms: Date.now() - started,
      warnings,
    };
  }

  if (decision.tier === 1) {
    try {
      const r = await invokeOllama({
        baseUrl: options.ollamaBaseUrl ?? process.env.WAVEX_OS_OLLAMA_BASE_URL ?? "http://127.0.0.1:11434",
        model: options.ollamaModel ?? process.env.WAVEX_OS_OLLAMA_MODEL ?? "llama3.2:3b",
        prompt: request.prompt,
        timeoutMs,
      });
      return {
        tier: 1,
        runtime: "ollama",
        output: r.text,
        cost: { usd: 0, tokens: r.evalCount },
        trace_id: traceId,
        duration_ms: Date.now() - started,
        warnings,
      };
    } catch (err) {
      warnings.push(`ollama failed: ${err instanceof Error ? err.message : String(err)} — falling back to T2`);
    }
  }

  // T2 path (either chosen by decide() or fallback from T1)
  const t2 = await invokeClaudeCode({
    bin: options.claudeBin ?? process.env.WAVEX_OS_CLAUDE_BIN ?? "claude",
    prompt: request.prompt,
    outputFormat: request.outputFormat ?? "text",
    timeoutMs,
  });
  return {
    tier: 2,
    runtime: decision.runtime === "claude-api-overflow" ? "claude-api-overflow" : "claude-code",
    output: t2.text,
    cost: {
      usd: t2.costUsd ?? 0,
      tokens: t2.outputTokens,
      window_consumed_pct: Math.max(budget.claude5hPctUsed, budget.claudeWeeklyPctUsed),
    },
    trace_id: traceId,
    duration_ms: Date.now() - started,
    warnings,
  };
}
