import { describe, expect, it } from "vitest";
import { assessCriticality } from "./criticality.js";
import type { KPISnapshot } from "./types.js";

function s(overrides: Partial<KPISnapshot> & { t: string }): KPISnapshot {
  return {
    mrr: 50_000,
    nrr: 1.05,
    grr: 0.94,
    cac: 800,
    cac_payback_months: 10,
    burn_multiple: 1.2,
    activation_rate: 0.4,
    sales_cycle_days: 20,
    win_rate: 0.2,
    ltv_cac_ratio: 3.0,
    pipeline_velocity: 100_000,
    narrative_strength: 0.5,
    ...overrides,
  };
}

describe("assessCriticality", () => {
  it("returns score 0 for empty history", () => {
    const r = assessCriticality([]);
    expect(r.flywheel_score).toBe(0);
    expect(r.auto_catalytic).toBe(false);
  });

  it("scores 2 when only NRR + burn are good (no trend data yet)", () => {
    const h = [s({ t: "t1", nrr: 1.15, burn_multiple: 1.0 })];
    const r = assessCriticality(h);
    expect(r.flywheel_score).toBe(2);
    expect(r.conditions.nrr_above_threshold).toBe(true);
    expect(r.conditions.burn_below_threshold).toBe(true);
    expect(r.conditions.activation_rising).toBe(false);
    expect(r.conditions.sales_cycle_compressing).toBe(false);
  });

  it("detects auto-catalytic when all 4 conditions hold across 3 cycles", () => {
    const h: KPISnapshot[] = [
      s({ t: "t1", nrr: 1.15, burn_multiple: 1.0, activation_rate: 0.40, sales_cycle_days: 22 }),
      s({ t: "t2", nrr: 1.18, burn_multiple: 1.0, activation_rate: 0.44, sales_cycle_days: 20 }),
      s({ t: "t3", nrr: 1.20, burn_multiple: 1.0, activation_rate: 0.48, sales_cycle_days: 18 }),
    ];
    const r = assessCriticality(h);
    expect(r.flywheel_score).toBe(4);
    expect(r.auto_catalytic).toBe(true);
  });

  it("refuses auto-catalytic when net trend is negative (activation regressed)", () => {
    const h: KPISnapshot[] = [
      s({ t: "t1", nrr: 1.15, burn_multiple: 1.0, activation_rate: 0.48, sales_cycle_days: 22 }),
      s({ t: "t2", nrr: 1.18, burn_multiple: 1.0, activation_rate: 0.50, sales_cycle_days: 20 }),
      s({ t: "t3", nrr: 1.20, burn_multiple: 1.0, activation_rate: 0.42, sales_cycle_days: 18 }), // regressed
    ];
    const r = assessCriticality(h);
    expect(r.conditions.activation_rising).toBe(false);
    expect(r.auto_catalytic).toBe(false);
    expect(r.flywheel_score).toBeLessThan(4);
  });

  it("NRR below threshold always flips flywheel_score under 4", () => {
    const h: KPISnapshot[] = [
      s({ t: "t1", nrr: 1.05, burn_multiple: 1.0, activation_rate: 0.40, sales_cycle_days: 22 }),
      s({ t: "t2", nrr: 1.08, burn_multiple: 1.0, activation_rate: 0.44, sales_cycle_days: 20 }),
      s({ t: "t3", nrr: 1.09, burn_multiple: 1.0, activation_rate: 0.48, sales_cycle_days: 18 }),
    ];
    const r = assessCriticality(h);
    expect(r.auto_catalytic).toBe(false);
  });
});
