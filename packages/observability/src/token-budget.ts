/**
 * Token budget awareness + adaptive throttling.
 *
 * Anthropic's Max plan exposes four quota tiers (5h, weekly all-models,
 * weekly Claude Design, Sonnet only). Without programmatic quota access,
 * we compute IMPUTED burn from `cost_events` and apply configurable
 * throttle thresholds. The wrapper script (Layer 1) handles the hard
 * fallback when Anthropic actually returns rate_limit_error.
 *
 * Throttle ladder (priority-aware):
 *   util > 70% : tier-4 agents refused
 *   util > 85% : tier-3+4 refused
 *   util > 95% : tier-2+3+4 refused
 *   util > 99% : tier-1 (CEO/CoS) gated by wake_reason criticality
 *
 * Tier mapping is defined here as a default. Override by injecting a
 * different `roleTiers` map at config time.
 */
import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import type { DbExecutor } from "./types.js";
import { sql } from "./sql-tag.js";

function unwrapRows<T>(result: T[] | { rows: T[] }): T[] {
  return Array.isArray(result) ? result : result.rows;
}

/* -------------------------------------------------------------------------- */
/* Role → tier mapping                                                        */
/* -------------------------------------------------------------------------- */

export const DEFAULT_ROLE_TIERS: Record<string, 1 | 2 | 3 | 4> = {
  ceo: 1,
  chief_of_staff: 1,
  cto: 2,
  cmo: 2,
  cro: 2,
  cdo: 2,
  cdo_attribute: 2,
  cdo_telemetry: 2,
  cdo_infer: 2,
  cdo_signal: 2,
  coo: 2,
  cfo: 2,
  cpo: 2,
  engineer: 3,
  pm: 3,
  devops: 3,
  // Researchers + general operators sit at tier 3 by default — under load
  // they typically ship real artifacts that drive KPIs. Demote to tier 4
  // if your deployment uses them as advisory roles.
  researcher: 3,
  general: 3,
  qa: 4,
};

let activeRoleTiers: Record<string, 1 | 2 | 3 | 4> = { ...DEFAULT_ROLE_TIERS };

export function setRoleTiers(map: Record<string, 1 | 2 | 3 | 4>): void {
  activeRoleTiers = { ...DEFAULT_ROLE_TIERS, ...map };
}

export function getCriticalityTier(role: string | null): 1 | 2 | 3 | 4 {
  if (!role) return 4;
  return activeRoleTiers[role] ?? 3;
}

/* -------------------------------------------------------------------------- */
/* Model pricing (cents per million tokens × 100 — i.e. cents per 100M)       */
/* -------------------------------------------------------------------------- */

export const TOKEN_RATES: Record<string, { input: number; cached: number; output: number }> = {
  "claude-opus-4-7": { input: 1500, cached: 150, output: 7500 },
  "claude-opus-4-7[1m]": { input: 1500, cached: 150, output: 7500 },
  "claude-opus-4-6": { input: 1500, cached: 150, output: 7500 },
  "claude-sonnet-4-6": { input: 300, cached: 30, output: 1500 },
  "claude-haiku-4-5-20251001": { input: 80, cached: 8, output: 400 },
  default: { input: 1500, cached: 150, output: 7500 },
};

function rateFor(model: string | null): { input: number; cached: number; output: number } {
  if (!model) return TOKEN_RATES.default;
  return TOKEN_RATES[model] ?? TOKEN_RATES.default;
}

/* -------------------------------------------------------------------------- */
/* Throttle thresholds (env-overridable)                                      */
/* -------------------------------------------------------------------------- */

function envInt(name: string, def: number): number {
  const v = process.env[name];
  if (!v) return def;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : def;
}

const BUDGET_5H_THROTTLE_CENTS = envInt("WAVEX_BUDGET_5H_THROTTLE_CENTS", 50_000);
const BUDGET_WEEKLY_THROTTLE_CENTS = envInt("WAVEX_BUDGET_WEEKLY_THROTTLE_CENTS", 200_000);

export type BudgetStatus = {
  computedAt: string;
  windows: {
    last1h: { burnCents: number; rateCentsPerMin: number };
    last5h: { burnCents: number; throttleCents: number; utilizationPct: number };
    last24h: { burnCents: number };
    last7d: { burnCents: number; throttleCents: number; utilizationPct: number };
  };
  fallbackEvents24h: number;
  recommendedThrottleCutoff: 0 | 70 | 85 | 95 | 99;
  recommendedAction:
    | "none"
    | "throttle_tier_4"
    | "throttle_tier_3+"
    | "throttle_tier_2+"
    | "throttle_all_but_critical";
};

export async function getBudgetStatus(db: DbExecutor, companyId: string): Promise<BudgetStatus> {
  const rows = unwrapRows(
    await db.execute<{
      bucket: string;
      output_tokens: string;
      cached_tokens: string;
      input_tokens: string;
      model: string | null;
    }>(sql`
      SELECT bucket, model,
        SUM(output_tokens)::text AS output_tokens,
        SUM(cached_input_tokens)::text AS cached_tokens,
        SUM(input_tokens)::text AS input_tokens
      FROM (
        SELECT model, output_tokens, cached_input_tokens, input_tokens,
          CASE
            WHEN occurred_at > NOW() - INTERVAL '1 hour' THEN '1h'
            WHEN occurred_at > NOW() - INTERVAL '5 hours' THEN '5h'
            WHEN occurred_at > NOW() - INTERVAL '24 hours' THEN '24h'
            WHEN occurred_at > NOW() - INTERVAL '7 days' THEN '7d'
            ELSE 'older'
          END AS bucket
        FROM cost_events
        WHERE company_id = ${companyId} AND occurred_at > NOW() - INTERVAL '7 days'
      ) t
      WHERE bucket <> 'older'
      GROUP BY bucket, model
    `),
  );

  const sums = { "1h": 0, "5h": 0, "24h": 0, "7d": 0 };
  for (const r of rows) {
    const rate = rateFor(r.model);
    const cents =
      (Number(r.output_tokens) * rate.output +
        Number(r.cached_tokens) * rate.cached +
        Number(r.input_tokens) * rate.input) /
      1_000_000;
    if (r.bucket === "1h") sums["1h"] += cents;
    if (r.bucket === "1h" || r.bucket === "5h") sums["5h"] += cents;
    if (r.bucket === "1h" || r.bucket === "5h" || r.bucket === "24h") sums["24h"] += cents;
    sums["7d"] += cents;
  }

  let fallbackEvents24h = 0;
  try {
    const logPath =
      process.env.WAVEX_FALLBACK_LOG_DIR ||
      path.join(homedir(), ".wavex-os", "state", "wrapper-fallback-logs");
    const content = await fs.readFile(path.join(logPath, "fallback.ndjson"), "utf8");
    const cutoff = Math.floor(Date.now() / 1000) - 24 * 3600;
    for (const line of content.split("\n")) {
      if (!line.trim()) continue;
      try {
        const ev = JSON.parse(line) as { ts?: number };
        if (typeof ev.ts === "number" && ev.ts >= cutoff) fallbackEvents24h++;
      } catch {
        /* ignore malformed lines */
      }
    }
  } catch {
    /* log file doesn't exist yet */
  }

  const util5h = sums["5h"] > 0 ? (sums["5h"] / BUDGET_5H_THROTTLE_CENTS) * 100 : 0;
  const util7d = sums["7d"] > 0 ? (sums["7d"] / BUDGET_WEEKLY_THROTTLE_CENTS) * 100 : 0;

  const observedPressure = util5h > util7d ? util5h : util7d;
  const fallbackPressureBoost =
    fallbackEvents24h >= 10 ? 30 : fallbackEvents24h >= 5 ? 15 : fallbackEvents24h >= 3 ? 5 : 0;
  const effectiveUtil = observedPressure + fallbackPressureBoost;

  let recommendedThrottleCutoff: 0 | 70 | 85 | 95 | 99 = 0;
  let recommendedAction: BudgetStatus["recommendedAction"] = "none";
  if (effectiveUtil > 99) {
    recommendedThrottleCutoff = 99;
    recommendedAction = "throttle_all_but_critical";
  } else if (effectiveUtil > 95) {
    recommendedThrottleCutoff = 95;
    recommendedAction = "throttle_tier_2+";
  } else if (effectiveUtil > 85) {
    recommendedThrottleCutoff = 85;
    recommendedAction = "throttle_tier_3+";
  } else if (effectiveUtil > 70) {
    recommendedThrottleCutoff = 70;
    recommendedAction = "throttle_tier_4";
  }

  return {
    computedAt: new Date().toISOString(),
    windows: {
      last1h: {
        burnCents: Math.round(sums["1h"] * 100) / 100,
        rateCentsPerMin: Math.round((sums["1h"] / 60) * 100) / 100,
      },
      last5h: {
        burnCents: Math.round(sums["5h"] * 100) / 100,
        throttleCents: BUDGET_5H_THROTTLE_CENTS,
        utilizationPct: Math.round(util5h * 10) / 10,
      },
      last24h: { burnCents: Math.round(sums["24h"] * 100) / 100 },
      last7d: {
        burnCents: Math.round(sums["7d"] * 100) / 100,
        throttleCents: BUDGET_WEEKLY_THROTTLE_CENTS,
        utilizationPct: Math.round(util7d * 10) / 10,
      },
    },
    fallbackEvents24h,
    recommendedThrottleCutoff,
    recommendedAction,
  };
}

/**
 * Decide whether to allow a wake for an agent given the current budget.
 * Returns null if allowed; returns a refusal object otherwise.
 *
 * Carve-out: tier-1 agents (CEO/CoS) bypass the 99% gate when wake_reason
 * matches /board_directive|recovery_protocol|critical|kpi_breach/i.
 *
 * Refuse-if-tier-AT-OR-ABOVE semantics: HIGHER tier number = LESS critical.
 * Easy to invert. Don't.
 */
export async function evaluateWakeBudget(
  db: DbExecutor,
  companyId: string,
  agentRole: string | null,
  wakeReason: string | null,
): Promise<null | {
  reason: string;
  tier: number;
  cutoff: number;
  utilization: number;
  retryAfterSeconds: number;
}> {
  const tier = getCriticalityTier(agentRole);
  const status = await getBudgetStatus(db, companyId);
  const cutoff = status.recommendedThrottleCutoff;
  const util = status.windows.last5h.utilizationPct + status.fallbackEvents24h * 5;

  if (cutoff === 0) return null;

  const refuseAtOrAbove = cutoff === 99 ? 1 : cutoff === 95 ? 2 : cutoff === 85 ? 3 : 4;
  if (tier < refuseAtOrAbove) return null;

  if (
    tier === 1 &&
    cutoff === 99 &&
    wakeReason &&
    /board_directive|recovery_protocol|critical|kpi_breach/i.test(wakeReason)
  ) {
    return null;
  }

  const rate = status.windows.last1h.rateCentsPerMin;
  const headroom = Math.max(
    0,
    status.windows.last5h.throttleCents * 0.8 - status.windows.last5h.burnCents,
  );
  const retryAfterSeconds =
    rate > 0 ? Math.min(3600, Math.max(60, Math.round((headroom / rate) * 60))) : 1200;

  return {
    reason: status.recommendedAction,
    tier,
    cutoff,
    utilization: util,
    retryAfterSeconds,
  };
}
