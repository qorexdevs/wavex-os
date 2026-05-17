/**
 * Client-side mirror of stage-bucket KPI baselines used by Pillar 3 to preview
 * what the system will estimate before the operator commits.
 *
 * Source of truth: `packages/plugins/onboarding/src/phases/phase-1-onboard/pillar-3.ts`.
 * Keep these in sync — values are stage-bucket initialisation defaults that flow
 * into `kpi_snapshot_initial` on the server.
 */

export interface StageBaselinePreview {
  mrr: number;
  cac: number;
  cac_payback_months: number;
  activation_rate: number;
  burn_multiple: number;
}

const PRE_PRODUCT: StageBaselinePreview = {
  mrr: 0,
  cac: 0,
  cac_payback_months: 0,
  activation_rate: 0,
  burn_multiple: 0,
};

const STAGE_BASELINES: Record<string, StageBaselinePreview> = {
  less_than_10k_mrr: { mrr: 5_000, cac: 400, cac_payback_months: 9, activation_rate: 0.35, burn_multiple: 1.4 },
  "10k_100k_mrr": { mrr: 45_000, cac: 900, cac_payback_months: 12, activation_rate: 0.42, burn_multiple: 1.3 },
  "100k_1m_mrr": { mrr: 400_000, cac: 1_500, cac_payback_months: 14, activation_rate: 0.5, burn_multiple: 1.1 },
  more_than_1m_mrr: { mrr: 1_800_000, cac: 2_500, cac_payback_months: 15, activation_rate: 0.55, burn_multiple: 0.9 },
};

/**
 * Returns the KPI baseline preview for a given (product_state, stage) combo.
 * Returns null when the operator hasn't selected a stage yet, or for `other`.
 */
export function previewBaseline(
  productState: string,
  stage: string,
): StageBaselinePreview | null {
  if (productState === "idea_only" || productState === "prototype_mvp") {
    return PRE_PRODUCT;
  }
  if (stage === "other") return null;
  return STAGE_BASELINES[stage] ?? null;
}

export function formatBaselinePreview(b: StageBaselinePreview): string {
  if (b.mrr === 0) {
    return "Pre-product: we'll start with all KPIs at zero. You'll refine these in the next step.";
  }
  return `We'll estimate MRR≈$${(b.mrr / 1000).toFixed(0)}k, CAC≈$${b.cac}, activation≈${(b.activation_rate * 100).toFixed(0)}%. You'll refine these in the next step.`;
}
