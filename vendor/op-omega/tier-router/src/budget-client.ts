/**
 * Thin HTTP client that asks @op-omega/plugin-rate-limit-budget for the
 * current company's budget snapshot via Paperclip's plugin bridge.
 *
 * Two exported surfaces:
 *   - `fetchBudgetSnapshot(...)` returns a legacy permissive-fallback shape.
 *     Still used by the T2 routing hot path where hard-halting every T2 call
 *     on transient budget outage would cascade badly.
 *   - `fetchBudgetSnapshotResult(...)` returns a result discriminator
 *     (`{ ok: true, snapshot } | { ok: false, error }`). Used by the
 *     onboarding Phase 4 pre-flight which MUST halt on failure because the
 *     resulting workflow manifest would have no enforceable budget gates.
 *   - `fetchBudgetSnapshotWithRetry(...)` wraps the result version in a
 *     3-attempt exponential backoff (2s, 4s, 8s).
 */

import type { BudgetSnapshot } from "./types.js";

export type BudgetClientResult =
  | { ok: true; snapshot: BudgetSnapshot }
  | { ok: false; error: string; retry_after_ms?: number };

function permissive(): BudgetSnapshot {
  return {
    claude5hPctUsed: 0,
    claudeWeeklyPctUsed: 0,
    canRouteT2: true,
    canOverflow: false,
    apiOverflowMonthlyRemainingUsd: 0,
    recommendation: "ok",
  };
}

function parseSnapshot(d: Record<string, unknown>): BudgetSnapshot {
  return {
    claude5hPctUsed: typeof d.claude5hPctUsed === "number" ? d.claude5hPctUsed : 0,
    claudeWeeklyPctUsed: typeof d.claudeWeeklyPctUsed === "number" ? d.claudeWeeklyPctUsed : 0,
    canRouteT2: d.canRouteT2 !== false,
    canOverflow: d.canOverflow === true,
    apiOverflowMonthlyRemainingUsd:
      typeof d.apiOverflowMonthlyBudgetUsd === "number" && typeof d.apiOverflowMonthlySpentUsd === "number"
        ? Math.max(0, d.apiOverflowMonthlyBudgetUsd - d.apiOverflowMonthlySpentUsd)
        : 0,
    recommendation:
      d.recommendation === "throttle" || d.recommendation === "defer_non_critical" || d.recommendation === "halt"
        ? d.recommendation
        : "ok",
  };
}

export async function fetchBudgetSnapshotResult(
  paperclipBaseUrl: string,
  companyId: string,
): Promise<BudgetClientResult> {
  try {
    const res = await fetch(
      `${paperclipBaseUrl}/api/plugins/op-omega.rate-limit-budget/data/budget-state`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ params: { companyId } }),
      },
    );
    if (!res.ok) {
      return { ok: false, error: `budget plugin HTTP ${res.status}` };
    }
    const body = (await res.json()) as { data?: Record<string, unknown> };
    return { ok: true, snapshot: parseSnapshot(body.data ?? {}) };
  } catch (err) {
    return { ok: false, error: `budget plugin unreachable: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export async function fetchBudgetSnapshotWithRetry(
  paperclipBaseUrl: string,
  companyId: string,
): Promise<BudgetClientResult> {
  const delays = [2_000, 4_000, 8_000];
  for (const delay of delays) {
    const result = await fetchBudgetSnapshotResult(paperclipBaseUrl, companyId);
    if (result.ok) return result;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return await fetchBudgetSnapshotResult(paperclipBaseUrl, companyId);
}

export async function fetchBudgetSnapshot(
  paperclipBaseUrl: string,
  companyId: string,
): Promise<{ snapshot: BudgetSnapshot; warning?: string }> {
  const result = await fetchBudgetSnapshotResult(paperclipBaseUrl, companyId);
  if (result.ok) return { snapshot: result.snapshot };
  return {
    snapshot: permissive(),
    warning: `${result.error}; assuming permissive`,
  };
}
