/** Client-side mirror of stage-bucket KPI baselines used by Pillar 3 to
 *  preview what the system will estimate before the operator commits.
 *  Source of truth: vendor/wavex-os/onboarding/src/phases/phase-1-onboard/pillar-3.ts. */

export interface StageBaselinePreview {
  mrr: number;
  cac: number;
  cac_payback_months: number;
  activation_rate: number;
  burn_multiple: number;
}

const PRE_PRODUCT: StageBaselinePreview = {
  mrr: 0, cac: 0, cac_payback_months: 0, activation_rate: 0, burn_multiple: 0,
};

const STAGE_BASELINES: Record<string, StageBaselinePreview> = {
  less_than_10k_mrr: { mrr: 5_000, cac: 400, cac_payback_months: 9, activation_rate: 0.35, burn_multiple: 1.4 },
  "10k_100k_mrr": { mrr: 45_000, cac: 900, cac_payback_months: 12, activation_rate: 0.42, burn_multiple: 1.3 },
  "100k_1m_mrr": { mrr: 400_000, cac: 1_500, cac_payback_months: 14, activation_rate: 0.5, burn_multiple: 1.1 },
  more_than_1m_mrr: { mrr: 1_800_000, cac: 2_500, cac_payback_months: 15, activation_rate: 0.55, burn_multiple: 0.9 },
};

export function previewBaseline(productState: string, stage: string): StageBaselinePreview | null {
  if (productState === "idea_only" || productState === "prototype_mvp") return PRE_PRODUCT;
  if (stage === "other") return null;
  return STAGE_BASELINES[stage] ?? null;
}

export function formatBaselinePreview(b: StageBaselinePreview): string {
  if (b.mrr === 0) {
    return "Pre-product: we'll start with all KPIs at zero. You'll refine these as you ship.";
  }
  const mrrLabel = b.mrr >= 1_000_000
    ? `$${(b.mrr / 1_000_000).toFixed(1)}M`
    : `$${(b.mrr / 1_000).toFixed(0)}k`;
  return `We'll estimate ~${mrrLabel} MRR · CAC $${b.cac} · payback ${b.cac_payback_months}mo · activation ${(b.activation_rate * 100).toFixed(0)}% · burn ${b.burn_multiple}×. Refine in the next step.`;
}
