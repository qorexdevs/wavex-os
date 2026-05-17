import { describe, expect, it } from "vitest";
import { bifurcate } from "./bifurcation.js";

describe("bifurcate", () => {
  it("recommends spawn when B(C) sustained above threshold ≥ 3 cycles", () => {
    // Each cycle: q×h×o/c → 6×0.9×0.7/2 = 1.89, 7→2.205, 8→2.52, 9→2.835, all > 1.8
    const r = bifurcate({
      queue_depth_history: [6, 7, 8, 9],
      task_heterogeneity_history: [0.9, 0.9, 0.9, 0.9],
      opportunity_cost: 0.7,
      attention_capacity: 2,
    });
    expect(r.spawn_recommended).toBe(true);
    expect(r.b_of_c).toBeGreaterThan(1.8);
  });

  it("does NOT spawn when signal only held 1 cycle", () => {
    const r = bifurcate({
      queue_depth_history: [1, 1, 1, 8],
      task_heterogeneity_history: [0.2, 0.2, 0.2, 0.9],
      opportunity_cost: 0.7,
      attention_capacity: 2,
    });
    expect(r.spawn_recommended).toBe(false);
  });

  it("recommends reabsorb when B(C) sustained below merge threshold ≥ 5 cycles", () => {
    const r = bifurcate({
      queue_depth_history: [0.5, 0.4, 0.3, 0.2, 0.1, 0.1],
      task_heterogeneity_history: [0.2, 0.2, 0.2, 0.2, 0.2, 0.2],
      opportunity_cost: 0.3,
      attention_capacity: 5,
    });
    expect(r.reabsorb_recommended).toBe(true);
  });

  it("handles zero attention_capacity gracefully", () => {
    const r = bifurcate({
      queue_depth_history: [1],
      task_heterogeneity_history: [0.5],
      opportunity_cost: 0.5,
      attention_capacity: 0,
    });
    expect(r.spawn_recommended).toBe(false);
    expect(r.reabsorb_recommended).toBe(false);
  });

  it("reports steady band when B is between thresholds", () => {
    // B = 3 × 0.7 × 0.5 / 1 = 1.05, between θ_merge=0.6 and θ_spawn=1.8
    const r = bifurcate({
      queue_depth_history: [3, 3, 3],
      task_heterogeneity_history: [0.7, 0.7, 0.7],
      opportunity_cost: 0.5,
      attention_capacity: 1,
    });
    expect(r.spawn_recommended).toBe(false);
    expect(r.reabsorb_recommended).toBe(false);
    expect(r.rationale).toMatch(/steady/);
  });
});
