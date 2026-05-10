import { describe, expect, it } from "vitest";
import { invokeMonteCarlo } from "./mc-invocation.js";
import { emptyPillarResponses, type PillarResponses } from "../../schema/pillar-responses.js";

function fullResponses(): PillarResponses {
  const base = emptyPillarResponses();
  base.pillar_1 = {
    org_name: "Acme",
    company_context: "…",
    has_product: true,
    industry_hint: "b2b_saas",
    business_model_hint: "subscription",
    raw_input: "https://acme.example",
    enriched_at: "2026-04-20T00:01:00Z",
  };
  base.pillar_2 = {
    claude_code_verified: true,
    claude_plan: "max_20x",
    inference_budget_profile: "premium",
    verified_at: "2026-04-20T00:02:00Z",
  };
  base.pillar_3 = {
    product_state: "live_paying_customers",
    stage: "10k_100k_mrr",
    kpi_snapshot_initial: {
      t: "2026-04-20T00:03:00Z",
      mrr: 45_000,
      nrr: 1.05,
      grr: 0.92,
      cac: 900,
      cac_payback_months: 12,
      burn_multiple: 1.3,
      activation_rate: 0.42,
      sales_cycle_days: 28,
      win_rate: 0.22,
      ltv_cac_ratio: 2.8,
      pipeline_velocity: 150_000,
      narrative_strength: 0.5,
      ai_estimated: true,
    },
  };
  base.pillar_4 = {
    lead_sources: ["outbound_cold"],
    lead_source: "outbound_cold",
    sales_motion: "high_touch_enterprise",
    close_channel: "mostly_phone_video",
    gtm_profile_enum: "OUTBOUND_HIGH_TOUCH_SAAS",
  };
  base.pillar_5 = { comm_channel: "slack" };
  return base;
}

describe("invokeMonteCarlo", () => {
  it("produces a winner with all expected stats", () => {
    const r = invokeMonteCarlo(fullResponses());
    expect(r.winner.strategy_id).toBeDefined();
    expect(r.winner.sharpe).toBeGreaterThanOrEqual(0);
    expect(r.winner.run_params.n_runs).toBe(30);
    expect(r.winner.run_params.horizon_cycles).toBe(30);
  });

  it("is deterministic with the same seed", () => {
    const a = invokeMonteCarlo(fullResponses(), { seed: 7 });
    const b = invokeMonteCarlo(fullResponses(), { seed: 7 });
    expect(a.winner.strategy_id).toBe(b.winner.strategy_id);
    expect(a.winner.sharpe).toBeCloseTo(b.winner.sharpe, 10);
  });

  it("throws when pillar 3 KPI snapshot is missing", () => {
    const bad = fullResponses();
    bad.pillar_3 = null;
    expect(() => invokeMonteCarlo(bad)).toThrow(/kpi_snapshot_initial missing/);
  });

  it("does NOT leak the ai_estimated flag into the simulator input", () => {
    const r = invokeMonteCarlo(fullResponses());
    expect("ai_estimated" in r.initial).toBe(false);
  });

  it("over 60 cycles, p_auto_catalytic is ≥ 0 and ≤ 1 for winner", () => {
    const r = invokeMonteCarlo(fullResponses(), { horizon_cycles: 60 });
    expect(r.winner.p_auto_catalytic).toBeGreaterThanOrEqual(0);
    expect(r.winner.p_auto_catalytic).toBeLessThanOrEqual(1);
  });
});
