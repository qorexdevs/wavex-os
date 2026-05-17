/**
 * Pillar 3 — Product & Stage. Produces an AI-estimated initial KPISnapshot
 * keyed to the declared stage bucket, flagged ai_estimated: true so the
 * Phase 3 swarm-generator knows these aren't real measurements yet.
 */

import type { KPISnapshot } from "@wavex-os/plugin-flywheel-kernel";
import type { Pillar3Response, ProductState } from "../../schema/pillar-responses.js";

export interface Pillar3Input {
  product_state: ProductState;
  product_state_other?: string;
  stage: string;
  stage_other?: string;
}

/**
 * Maps stage bucket → representative KPISnapshot. These are *estimates* — the
 * onboarding calls them ai_estimated so anything downstream can either use
 * them as a starting point or request the operator refine them later.
 */
function estimateKpiSnapshot(productState: ProductState, stage: string): KPISnapshot {
  const t = new Date().toISOString();
  const preProduct: KPISnapshot = {
    t,
    mrr: 0,
    nrr: 1.0,
    grr: 1.0,
    cac: 0,
    cac_payback_months: 0,
    burn_multiple: 0,
    activation_rate: 0,
    sales_cycle_days: 0,
    win_rate: 0,
    ltv_cac_ratio: 0,
    pipeline_velocity: 0,
    narrative_strength: 0.3,
  };
  if (productState === "idea_only" || productState === "prototype_mvp") return preProduct;

  // live product buckets
  if (stage === "less_than_10k_mrr") {
    return {
      t,
      mrr: 5_000,
      nrr: 0.95,
      grr: 0.88,
      cac: 400,
      cac_payback_months: 9,
      burn_multiple: 1.4,
      activation_rate: 0.35,
      sales_cycle_days: 21,
      win_rate: 0.18,
      ltv_cac_ratio: 2.2,
      pipeline_velocity: 30_000,
      narrative_strength: 0.4,
    };
  }
  if (stage === "10k_100k_mrr") {
    return {
      t,
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
    };
  }
  if (stage === "100k_1m_mrr") {
    return {
      t,
      mrr: 400_000,
      nrr: 1.10,
      grr: 0.94,
      cac: 1_500,
      cac_payback_months: 14,
      burn_multiple: 1.1,
      activation_rate: 0.5,
      sales_cycle_days: 35,
      win_rate: 0.25,
      ltv_cac_ratio: 3.2,
      pipeline_velocity: 600_000,
      narrative_strength: 0.6,
    };
  }
  if (stage === "more_than_1m_mrr") {
    return {
      t,
      mrr: 1_800_000,
      nrr: 1.15,
      grr: 0.95,
      cac: 2_500,
      cac_payback_months: 15,
      burn_multiple: 0.9,
      activation_rate: 0.55,
      sales_cycle_days: 45,
      win_rate: 0.28,
      ltv_cac_ratio: 3.8,
      pipeline_velocity: 3_000_000,
      narrative_strength: 0.7,
    };
  }

  // pre-revenue states for live-ish products
  return {
    ...preProduct,
    narrative_strength: 0.4,
  };
}

export async function handlePillar3(input: Pillar3Input): Promise<Pillar3Response> {
  const snapshot = estimateKpiSnapshot(input.product_state, input.stage);
  return {
    product_state: input.product_state,
    product_state_other: input.product_state_other,
    stage: input.stage,
    stage_other: input.stage_other,
    kpi_snapshot_initial: { ...snapshot, ai_estimated: true },
  };
}
