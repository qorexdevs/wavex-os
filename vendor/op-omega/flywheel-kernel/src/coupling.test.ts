import { describe, expect, it } from "vitest";
import { couple } from "./coupling.js";
import type { KPISnapshot } from "./types.js";

function snap(overrides: Partial<KPISnapshot> = {}): KPISnapshot {
  return {
    t: "2026-04-20T00:00:00Z",
    mrr: 50_000,
    nrr: 1.05,
    grr: 0.94,
    cac: 800,
    cac_payback_months: 10,
    burn_multiple: 1.2,
    activation_rate: 0.42,
    sales_cycle_days: 21,
    win_rate: 0.24,
    ltv_cac_ratio: 3.2,
    pipeline_velocity: 180_000,
    narrative_strength: 0.55,
    ...overrides,
  };
}

describe("couple() — R(t+1) equation", () => {
  it("without prior snapshot, compounds at (η × ν) when burn is healthy", () => {
    const r = couple(snap({ burn_multiple: 1.0 }));
    // η(1.0)=1.0, ν(0.55)=1.0825, multiplier ≈ 1.0825, so mrr should grow
    expect(r.next.mrr).toBeGreaterThan(50_000);
    expect(r.delta.mrr!).toBeGreaterThan(0);
  });

  it("shrinks revenue when burn is high enough that η × ν < 1", () => {
    const r = couple(snap({ burn_multiple: 2.0, narrative_strength: 0.1 }));
    // η(2.0)=0.5 wait that's wrong, max(0.5, 2-2)=max(0.5,0)=0.5, ν(0.1)=1.015, total=0.5×1.015<1
    expect(r.next.mrr).toBeLessThan(50_000);
  });

  it("narrative_strength raises the multiplier", () => {
    const low = couple(snap({ narrative_strength: 0.1 })).next.mrr;
    const high = couple(snap({ narrative_strength: 0.9 })).next.mrr;
    expect(high).toBeGreaterThan(low);
  });

  it("high burn_multiple degrades η to the floor", () => {
    const healthy = couple(snap({ burn_multiple: 1.0 })).next.mrr;
    const burning = couple(snap({ burn_multiple: 5.0 })).next.mrr;
    expect(burning).toBeLessThan(healthy);
  });

  it("η floor at 0.5 prevents negative compounding", () => {
    const r = couple(snap({ burn_multiple: 10 }));
    expect(r.next.mrr).toBeGreaterThan(0);
  });

  it("scores cycle criticality conditions", () => {
    const prev = snap({ activation_rate: 0.4, sales_cycle_days: 25 });
    const curr = snap({
      nrr: 1.15,            // cond 1
      burn_multiple: 1.0,    // cond 2
      activation_rate: 0.5,  // cond 3
      sales_cycle_days: 18,  // cond 4
    });
    const r = couple(curr, prev);
    expect(r.cycle_criticality_score).toBe(4);
  });

  it("attributes bundle contributions", () => {
    const r = couple(snap(), snap({ activation_rate: 0.35, pipeline_velocity: 150_000 }));
    expect(r.bundle_contributions.insight_activation).toBeGreaterThan(0);
    expect(r.bundle_contributions.pipeline_velocity).toBeGreaterThan(0);
  });
});
