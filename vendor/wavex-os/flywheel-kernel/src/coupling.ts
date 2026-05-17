/**
 * Operator Ω · coupling equation (OPΩ-SPEC §5.4).
 *
 *   R(t+1) = R(t) × (1 + g_act · g_pipe · g_conv) × η(burn) × ν(narrative)
 *
 *     g_act   = activation_delta × 0.30   (Bundle 1 contribution)
 *     g_pipe  = pipeline_delta   × 0.40   (Bundle 2 contribution)
 *     g_conv  = conversion_delta × 0.30   (Bundle 2+3 joint)
 *     η(burn) = max(0.5, 2.0 - burn_multiple)
 *     ν(narr) = 1.0 + narrative_strength × 0.15
 *
 * This function is pure and deterministic. `previous` is the prior cycle's
 * snapshot used to compute the *deltas* that drive the growth multiplier.
 * Omit it to treat the input as the baseline (no deltas, compounds by
 * narrative + burn efficiency alone).
 */

import type { KPISnapshot, CouplingResult, BundleId } from "./types.js";

const BUNDLE_CONTRIB_WEIGHTS = {
  activation: 0.3,
  pipeline: 0.4,
  conversion: 0.3,
};

export interface CouplingOptions {
  /** Floor on η(burn). Defaults to 0.5 per spec. */
  etaFloor?: number;
  /** Narrative weight. Defaults to 0.15 per spec. */
  narrativeWeight?: number;
}

export function couple(
  input: KPISnapshot,
  previous?: KPISnapshot,
  options: CouplingOptions = {},
): CouplingResult {
  const etaFloor = options.etaFloor ?? 0.5;
  const narrativeWeight = options.narrativeWeight ?? 0.15;

  // Deltas: ratio of change relative to prior cycle; 0 when no prior.
  const activationDelta = previous ? safeDelta(input.activation_rate, previous.activation_rate) : 0;
  const pipelineDelta = previous ? safeDelta(input.pipeline_velocity, previous.pipeline_velocity) : 0;
  // Conversion is a joint of win_rate and activation_rate (from Bundle 2+3):
  const conversionDelta = previous
    ? 0.5 * safeDelta(input.win_rate, previous.win_rate) + 0.5 * safeDelta(input.activation_rate, previous.activation_rate)
    : 0;

  const gAct = activationDelta * BUNDLE_CONTRIB_WEIGHTS.activation;
  const gPipe = pipelineDelta * BUNDLE_CONTRIB_WEIGHTS.pipeline;
  const gConv = conversionDelta * BUNDLE_CONTRIB_WEIGHTS.conversion;

  const eta = Math.max(etaFloor, 2.0 - input.burn_multiple);
  const nu = 1.0 + input.narrative_strength * narrativeWeight;

  const multiplier = (1 + gAct * gPipe * gConv) * eta * nu;

  const nextMrr = input.mrr * multiplier;

  // NRR couples to activation via (activation_rate - 0.40) × 0.015 (from v1.0 §4.6)
  const nrrCouple = (input.activation_rate - 0.40) * 0.015;
  // win_rate couples to narrative via (narrative_strength - 0.5) × 0.008
  const winRateCouple = (input.narrative_strength - 0.5) * 0.008;
  // sales_cycle responds to inbound_quality proxy (we use narrative as proxy here)
  const cycleCouple = -(input.narrative_strength - 0.5) * 4;

  const next: KPISnapshot = {
    ...input,
    t: new Date().toISOString(),
    mrr: nextMrr,
    nrr: clamp(input.nrr + nrrCouple, 0, 3),
    win_rate: clamp(input.win_rate + winRateCouple, 0, 1),
    sales_cycle_days: Math.max(0, input.sales_cycle_days + cycleCouple),
  };

  const delta: CouplingResult["delta"] = {
    mrr: nextMrr - input.mrr,
    nrr: nrrCouple,
    win_rate: winRateCouple,
    sales_cycle_days: cycleCouple,
  };

  // Per-condition score for THIS cycle only (full flywheel_score uses criticality.ts over 3-cycle window).
  let cycleScore = 0;
  if (next.nrr > 1.10) cycleScore += 1;
  if (next.burn_multiple < 1.5) cycleScore += 1;
  if (previous && next.activation_rate > previous.activation_rate) cycleScore += 1;
  if (previous && next.sales_cycle_days < previous.sales_cycle_days) cycleScore += 1;

  return {
    next,
    delta,
    cycle_criticality_score: cycleScore as 0 | 1 | 2 | 3 | 4,
    bundle_contributions: contributionsBy(gAct, gPipe, gConv, eta, nu),
  };
}

function safeDelta(next: number, prev: number): number {
  if (!Number.isFinite(prev) || prev === 0) return 0;
  return (next - prev) / Math.abs(prev);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function contributionsBy(
  gAct: number,
  gPipe: number,
  gConv: number,
  eta: number,
  nu: number,
): Record<BundleId, number> {
  // Rough attribution: each bundle contributes proportionally to its g-value
  // and the burn-efficiency multiplier gates unit_economics; narrative drives
  // strategic_positioning.
  return {
    insight_activation: gAct,
    pipeline_velocity: gPipe,
    expansion_engine: gConv,
    unit_economics: eta - 1.0,
    strategic_positioning: nu - 1.0,
  };
}
