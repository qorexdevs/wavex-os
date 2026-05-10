/**
 * Operator Ω · flywheel-kernel public types.
 *
 * The KPISnapshot is the canonical state vector. All kernel math takes or
 * returns KPISnapshot[]. A cycle is one simulation tick (configurable
 * real-world duration, e.g. 1 hour per OPΩ-SPEC §5.4 default).
 */

export const BUNDLE_IDS = [
  "insight_activation",
  "pipeline_velocity",
  "expansion_engine",
  "unit_economics",
  "strategic_positioning",
] as const;
export type BundleId = (typeof BUNDLE_IDS)[number];

export const STRATEGY_IDS = [
  "RETENTION_FIRST",
  "BALANCED",
  "ACQUISITION_HEAVY",
  "NARRATIVE_LED",
  "CAPITAL_EFFICIENT",
] as const;
export type StrategyId = (typeof STRATEGY_IDS)[number];

export interface KPISnapshot {
  /** ISO 8601 timestamp for this cycle. */
  t: string;
  mrr: number;
  /** Net revenue retention (1.0 = flat, 1.10 = 110%). */
  nrr: number;
  /** Gross revenue retention. */
  grr: number;
  /** Customer acquisition cost, USD. */
  cac: number;
  cac_payback_months: number;
  /** Net burn / net new ARR. <1.5 is healthy. */
  burn_multiple: number;
  /** 0..1 — fraction of signups that reach activation. */
  activation_rate: number;
  sales_cycle_days: number;
  /** 0..1 — fraction of qualified deals closed. */
  win_rate: number;
  ltv_cac_ratio: number;
  /** Dimensionless proxy for dollars moving through pipeline per cycle. */
  pipeline_velocity: number;
  /** 0..1 composite of brand/narrative health. */
  narrative_strength: number;
}

export interface CouplingResult {
  /** The post-coupling snapshot (what KPIs look like after one cycle). */
  next: KPISnapshot;
  /** Delta vs. input snapshot, per KPI. */
  delta: Partial<Record<keyof KPISnapshot, number>>;
  /** 0..4 — count of met criticality conditions (this cycle). */
  cycle_criticality_score: 0 | 1 | 2 | 3 | 4;
  /** Per-bundle contribution to R(t+1) multiplier. */
  bundle_contributions: Record<BundleId, number>;
}

export interface CriticalityResult {
  /** 0..4 — criticality conditions met over the most-recent 3-cycle window. */
  flywheel_score: 0 | 1 | 2 | 3 | 4;
  /** True iff all four conditions hold simultaneously. */
  auto_catalytic: boolean;
  /** Per-condition detail, for UI + debugging. */
  conditions: {
    nrr_above_threshold: boolean;
    burn_below_threshold: boolean;
    activation_rising: boolean;
    sales_cycle_compressing: boolean;
  };
}

export interface BifurcationInput {
  /** Cycles worth of queue depth for this agent (rolling window). */
  queue_depth_history: number[];
  /** 0..1 — embedding variance across pending tasks this cycle. */
  task_heterogeneity_history: number[];
  /** Projected revenue lift, 0..1 normalized, if the work were specialized. */
  opportunity_cost: number;
  /** Agent's effective task-throughput per cycle. */
  attention_capacity: number;
}

export interface BifurcationResult {
  b_of_c: number;
  spawn_recommended: boolean;
  reabsorb_recommended: boolean;
  rationale: string;
  /** Configured thresholds used for this evaluation. */
  thresholds: { theta_spawn: number; theta_merge: number };
}

export interface BundleAllocation extends Record<BundleId, number> {
  insight_activation: number;
  pipeline_velocity: number;
  expansion_engine: number;
  unit_economics: number;
  strategic_positioning: number;
}

export interface StrategyDefinition {
  id: StrategyId;
  displayName: string;
  description: string;
  /** Weights across the 5 bundles; normalized to sum 1 when applied. */
  weights: BundleAllocation;
  /**
   * Risk profile — informational only; does not affect coupling math.
   * Higher = more variance in expected outcomes.
   */
  risk_profile: "defensive" | "balanced" | "aggressive";
}

/** MC simulation mode derived from pillar_3.stage (see `selectMCModel`). */
export type MCModelMode = "pre_scale" | "growth" | "scale";

export interface MonteCarloInput {
  initial: KPISnapshot;
  strategy: StrategyDefinition;
  /** Cycles per run (horizon). */
  horizon_cycles: number;
  /** How many independent runs per strategy. */
  n_runs: number;
  /** Seed for reproducibility. */
  seed?: number;
  /** Per-KPI stddev as fraction of value (e.g. 0.05 = ±5% noise per cycle). */
  noise_scale?: number;
  /** Stage-aware coupling model. Defaults to "growth". */
  mode?: MCModelMode;
}

export interface MonteCarloRunResult {
  final_mrr: number;
  mrr_growth: number; // (final - initial) / initial
  mean_burn_multiple: number;
  reached_auto_catalytic: boolean;
  cycles_to_auto_catalytic: number | null;
  final_snapshot: KPISnapshot;
  /** Pre-scale operators: activation trajectory instead of MRR growth. */
  activation_growth?: number;
  mean_activation_rate?: number;
}

export interface MonteCarloStrategyResult {
  strategy_id: StrategyId;
  n_runs: number;
  horizon_cycles: number;
  mean_mrr_growth: number;
  std_mrr_growth: number;
  sharpe: number;
  mean_burn_multiple: number;
  p_ruin: number;
  p_auto_catalytic: number;
  mean_cycles_to_critical: number | null;
  /** Pre-scale operators: average activation-rate growth over the horizon. */
  mean_activation_growth?: number;
}

export interface MonteCarloReport {
  generated_at: string;
  horizon_cycles: number;
  n_runs_per_strategy: number;
  seed: number;
  /** Stage-aware coupling model used for this run. */
  mode?: MCModelMode;
  strategies: MonteCarloStrategyResult[];
  winner: {
    strategy_id: StrategyId;
    rationale: string;
  };
}
