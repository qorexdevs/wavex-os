import { describe, expect, it } from "vitest";
import { handlePillar3 } from "./pillar-3.js";

describe("Pillar 3 · Product & Stage KPI estimation", () => {
  it("pre-product state returns zeroed KPIs", async () => {
    const r = await handlePillar3({ product_state: "idea_only", stage: "pre_product" });
    expect(r.kpi_snapshot_initial.mrr).toBe(0);
    expect(r.kpi_snapshot_initial.ai_estimated).toBe(true);
  });

  it("live 10k-100k returns ~45k baseline with healthy narrative", async () => {
    const r = await handlePillar3({ product_state: "live_paying_customers", stage: "10k_100k_mrr" });
    expect(r.kpi_snapshot_initial.mrr).toBe(45_000);
    expect(r.kpi_snapshot_initial.nrr).toBeGreaterThan(1.0);
    expect(r.kpi_snapshot_initial.ai_estimated).toBe(true);
  });

  it("live >1M MRR has higher NRR + lower burn per scale", async () => {
    const r = await handlePillar3({ product_state: "live_paying_customers", stage: "more_than_1m_mrr" });
    expect(r.kpi_snapshot_initial.mrr).toBeGreaterThan(1_000_000);
    expect(r.kpi_snapshot_initial.burn_multiple).toBeLessThan(1.0);
  });
});
