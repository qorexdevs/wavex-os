/**
 * Operator Ω · Monte Carlo simulator (OPΩ-SPEC §5.4).
 *
 * For each strategy, runs N parallel simulations × M horizon cycles and
 * returns Sharpe-ranked results. Single-threaded (TS worker-threads deferred
 * — ~100 runs × 30 cycles across 5 strategies completes in ≤ 1s on an M-class
 * laptop). Deterministic with a seed.
 *
 * Stage-aware modes (WaveX audit F7B):
 *   - `pre_scale`  : compounding dynamics haven't started. Freeze MRR and
 *                    optimize for activation + runway preservation. Prevents
 *                    the degenerate "-49% projected growth" output that the
 *                    scale-stage coupling produces at sub-$10k MRR.
 *   - `growth`     : standard compounding model — existing spec §5.4 logic.
 *   - `scale`      : NRR-weighted winner selection on top of growth coupling.
 *
 * Mode defaults to `growth`. Onboarding passes the operator's stage through
 * when it invokes the MC.
 */

import type {
  KPISnapshot,
  MonteCarloInput,
  MonteCarloRunResult,
  MonteCarloStrategyResult,
  MonteCarloReport,
  StrategyDefinition,
  BundleAllocation,
} from "../types.js";
import { couple } from "../coupling.js";
import { assessCriticality } from "../criticality.js";
import { STRATEGIES } from "./strategies.js";

export type MCModelMode = "pre_scale" | "growth" | "scale";

/** Pick the stage-appropriate MC model from a pillar_3.stage string. */
export function selectMCModel(stage: string | undefined): MCModelMode {
  if (!stage) return "growth";
  if (stage === "pre_product" || stage === "pre_launch" || stage === "soft_launched" || stage === "less_than_10k_mrr") {
    return "pre_scale";
  }
  if (stage === "more_than_1m_mrr") return "scale";
  return "growth";
}

/** Linear-congruential PRNG for deterministic seeded runs. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  if (s === 0) s = 1; // avoid stuck-at-zero
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function normalNoise(rng: () => number): number {
  // Box-Muller
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function perturb(base: number, scale: number, rng: () => number): number {
  return base * (1 + normalNoise(rng) * scale);
}

function applyStrategy(snap: KPISnapshot, weights: BundleAllocation, intensity = 0.02): KPISnapshot {
  // Normalize weights.
  const total =
    weights.insight_activation +
    weights.pipeline_velocity +
    weights.expansion_engine +
    weights.unit_economics +
    weights.strategic_positioning;
  const n = {
    insight_activation: weights.insight_activation / total,
    pipeline_velocity: weights.pipeline_velocity / total,
    expansion_engine: weights.expansion_engine / total,
    unit_economics: weights.unit_economics / total,
    strategic_positioning: weights.strategic_positioning / total,
  };
  return {
    ...snap,
    // activation is driven by insight_activation bundle
    activation_rate: clamp(snap.activation_rate + n.insight_activation * intensity, 0, 1),
    // pipeline velocity by pipeline bundle
    pipeline_velocity: snap.pipeline_velocity * (1 + n.pipeline_velocity * intensity * 5),
    // nrr boosted by expansion work
    nrr: clamp(snap.nrr + n.expansion_engine * intensity, 0, 3),
    // burn multiple reduced by unit_economics work (lower is better)
    burn_multiple: Math.max(0, snap.burn_multiple - n.unit_economics * intensity * 2),
    // narrative strength by positioning
    narrative_strength: clamp(snap.narrative_strength + n.strategic_positioning * intensity, 0, 1),
  };
}

export function simulateRun(input: MonteCarloInput, seedOverride?: number): MonteCarloRunResult {
  const seed = seedOverride ?? input.seed ?? 42;
  const rng = lcg(seed);
  const mode: MCModelMode = input.mode ?? "growth";
  // Pre-scale operators damp the noise so projections don't appear as
  // catastrophic MRR swings — the coupling equation is not calibrated for
  // that regime and raw output misleads the operator.
  const noiseScale = input.noise_scale ?? (mode === "pre_scale" ? 0.01 : 0.03);

  let current = input.initial;
  const history: KPISnapshot[] = [current];
  let cyclesToAutoCatalytic: number | null = null;
  let burnSum = 0;
  let activationSum = current.activation_rate;

  for (let cycle = 0; cycle < input.horizon_cycles; cycle++) {
    const strategyApplied = applyStrategy(current, input.strategy.weights);

    let noisy: KPISnapshot;
    let next: KPISnapshot;
    if (mode === "pre_scale") {
      // Freeze MRR at initial — pre-scale operators don't have compounding
      // dynamics yet. Focus on activation_rate + burn_multiple movement.
      noisy = {
        ...strategyApplied,
        mrr: input.initial.mrr, // no compounding
        activation_rate: clamp(perturb(strategyApplied.activation_rate, noiseScale, rng), 0, 1),
        burn_multiple: Math.max(0, perturb(strategyApplied.burn_multiple, noiseScale, rng)),
        narrative_strength: clamp(perturb(strategyApplied.narrative_strength, noiseScale, rng), 0, 1),
      };
      next = {
        ...noisy,
        t: new Date().toISOString(),
      };
    } else {
      noisy = {
        ...strategyApplied,
        mrr: perturb(strategyApplied.mrr, noiseScale, rng),
        activation_rate: clamp(perturb(strategyApplied.activation_rate, noiseScale, rng), 0, 1),
        pipeline_velocity: perturb(strategyApplied.pipeline_velocity, noiseScale, rng),
        burn_multiple: Math.max(0, perturb(strategyApplied.burn_multiple, noiseScale, rng)),
        narrative_strength: clamp(perturb(strategyApplied.narrative_strength, noiseScale, rng), 0, 1),
      };
      const coupled = couple(noisy, current);
      next = coupled.next;
    }

    current = next;
    history.push(current);
    burnSum += current.burn_multiple;
    activationSum += current.activation_rate;

    if (cyclesToAutoCatalytic === null) {
      const crit = assessCriticality(history);
      if (crit.auto_catalytic) {
        cyclesToAutoCatalytic = cycle + 1;
      }
    }
  }

  const activationGrowth =
    input.initial.activation_rate > 0
      ? (current.activation_rate - input.initial.activation_rate) / input.initial.activation_rate
      : current.activation_rate;

  return {
    final_mrr: current.mrr,
    mrr_growth: input.initial.mrr > 0 ? (current.mrr - input.initial.mrr) / input.initial.mrr : 0,
    mean_burn_multiple: burnSum / input.horizon_cycles,
    reached_auto_catalytic: cyclesToAutoCatalytic !== null,
    cycles_to_auto_catalytic: cyclesToAutoCatalytic,
    final_snapshot: current,
    /** Pre-scale operators care more about activation trajectory than MRR. */
    activation_growth: activationGrowth,
    mean_activation_rate: activationSum / (input.horizon_cycles + 1),
  };
}

export function simulateStrategy(
  initial: KPISnapshot,
  strategy: StrategyDefinition,
  horizon_cycles: number,
  n_runs: number,
  seed: number,
  noise_scale?: number,
  mode: MCModelMode = "growth",
): MonteCarloStrategyResult {
  const results: MonteCarloRunResult[] = [];
  for (let i = 0; i < n_runs; i++) {
    results.push(
      simulateRun(
        { initial, strategy, horizon_cycles, n_runs: 1, seed: seed + i * 7919, noise_scale, mode },
        seed + i * 7919,
      ),
    );
  }
  const growths = results.map((r) => r.mrr_growth);
  const burns = results.map((r) => r.mean_burn_multiple);
  const meanGrowth = mean(growths);
  const stdGrowth = std(growths);
  const reachedCycles = results
    .map((r) => r.cycles_to_auto_catalytic)
    .filter((n): n is number => typeof n === "number");
  const ruinCount = results.filter((r) => r.mean_burn_multiple > 3.0).length;
  const activationGrowths = results.map((r) => r.activation_growth ?? 0);
  const meanActivationGrowth = mean(activationGrowths);

  return {
    strategy_id: strategy.id,
    n_runs,
    horizon_cycles,
    mean_mrr_growth: meanGrowth,
    std_mrr_growth: stdGrowth,
    sharpe: stdGrowth > 0 ? meanGrowth / stdGrowth : 0,
    mean_burn_multiple: mean(burns),
    p_ruin: ruinCount / n_runs,
    p_auto_catalytic: reachedCycles.length / n_runs,
    mean_cycles_to_critical: reachedCycles.length > 0 ? mean(reachedCycles) : null,
    mean_activation_growth: meanActivationGrowth,
  };
}

export function runMonteCarlo(
  initial: KPISnapshot,
  horizon_cycles = 30,
  n_runs = 20,
  seed = 42,
  noise_scale?: number,
  strategies = STRATEGIES,
  mode: MCModelMode = "growth",
): MonteCarloReport {
  const strategyResults = strategies.map((s, idx) =>
    simulateStrategy(initial, s, horizon_cycles, n_runs, seed + idx * 10007, noise_scale, mode),
  );

  // Winner selection is mode-aware. Pre-scale optimizes activation trajectory
  // + runway preservation (low p_ruin), not Sharpe-on-MRR-growth.
  let winner: MonteCarloStrategyResult;
  if (mode === "pre_scale") {
    // Lowest p_ruin, break ties by highest mean_activation_growth.
    winner = strategyResults.reduce((best, r) => {
      if (r.p_ruin < best.p_ruin) return r;
      if (r.p_ruin === best.p_ruin && (r.mean_activation_growth ?? 0) > (best.mean_activation_growth ?? 0)) return r;
      return best;
    }, strategyResults[0]);
  } else {
    // Growth + scale: existing Sharpe-based selection, preferring p_ruin < 0.25.
    const eligible = strategyResults.filter((r) => r.p_ruin < 0.25);
    const pool = eligible.length > 0 ? eligible : strategyResults;
    winner = pool.reduce((best, r) => (r.sharpe > best.sharpe ? r : best), pool[0]);
  }
  const rationale = explainWinner(winner, strategyResults, mode);

  return {
    generated_at: new Date().toISOString(),
    horizon_cycles,
    n_runs_per_strategy: n_runs,
    seed,
    mode,
    strategies: strategyResults,
    winner: {
      strategy_id: winner.strategy_id,
      rationale,
    },
  };
}

function explainWinner(winner: MonteCarloStrategyResult, all: MonteCarloStrategyResult[], mode: MCModelMode = "growth"): string {
  if (mode === "pre_scale") {
    const actGrowth = ((winner.mean_activation_growth ?? 0) * 100).toFixed(1);
    return `${winner.strategy_id} wins on capital preservation: p(ruin) ${(winner.p_ruin * 100).toFixed(0)}%, mean activation-rate growth ${actGrowth}% over horizon. MRR is held flat at this stage — compounding dynamics haven't started yet.`;
  }
  const next = [...all]
    .filter((r) => r.strategy_id !== winner.strategy_id)
    .sort((a, b) => b.sharpe - a.sharpe)[0];
  const pctLead = next ? ((winner.sharpe - next.sharpe) / Math.max(1e-6, Math.abs(next.sharpe))) * 100 : 0;
  return `${winner.strategy_id} wins: sharpe ${winner.sharpe.toFixed(2)} (next ${next?.strategy_id ?? "-"} at ${next?.sharpe.toFixed(2) ?? "-"}, ${pctLead.toFixed(0)}% lead). Mean MRR growth ${(winner.mean_mrr_growth * 100).toFixed(1)}%, p(auto-catalytic) ${(winner.p_auto_catalytic * 100).toFixed(0)}%, p(ruin) ${(winner.p_ruin * 100).toFixed(0)}%.`;
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function std(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
