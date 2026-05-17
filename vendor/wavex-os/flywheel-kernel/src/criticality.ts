/**
 * Operator Ω · 4-condition criticality check (OPΩ-SPEC §5.4).
 *
 * Auto-catalytic when all four hold simultaneously over the most-recent
 * 3-cycle window:
 *   (1) nrr > 1.10
 *   (2) burn_multiple < 1.5
 *   (3) activation_rate strictly rising across 3 cycles
 *   (4) sales_cycle_days strictly compressing across 3 cycles
 */

import type { KPISnapshot, CriticalityResult } from "./types.js";

export interface CriticalityOptions {
  nrrThreshold?: number;
  burnThreshold?: number;
  /** Minimum number of cycles for trend detection. Defaults to 3. */
  trendWindow?: number;
}

export function assessCriticality(
  history: readonly KPISnapshot[],
  options: CriticalityOptions = {},
): CriticalityResult {
  const nrrThreshold = options.nrrThreshold ?? 1.10;
  const burnThreshold = options.burnThreshold ?? 1.5;
  const trendWindow = options.trendWindow ?? 3;

  if (history.length === 0) {
    return zeroResult();
  }
  const latest = history[history.length - 1];

  const nrrOk = latest.nrr > nrrThreshold;
  const burnOk = latest.burn_multiple < burnThreshold;

  let activationRising = false;
  let cycleCompressing = false;
  if (history.length >= trendWindow) {
    const window = history.slice(-trendWindow);
    const activations = window.map((s) => s.activation_rate);
    const cycles = window.map((s) => s.sales_cycle_days);
    // Net trend over the window: last > first AND average of second half > first half.
    // More robust to per-cycle noise than strict monotonic.
    activationRising =
      activations[activations.length - 1] > activations[0] &&
      mean(activations.slice(Math.ceil(activations.length / 2))) > mean(activations.slice(0, Math.floor(activations.length / 2) + 1));
    cycleCompressing =
      cycles[cycles.length - 1] < cycles[0] &&
      mean(cycles.slice(Math.ceil(cycles.length / 2))) < mean(cycles.slice(0, Math.floor(cycles.length / 2) + 1));
  }

  const score = [nrrOk, burnOk, activationRising, cycleCompressing].filter(Boolean).length as 0 | 1 | 2 | 3 | 4;

  return {
    flywheel_score: score,
    auto_catalytic: score === 4,
    conditions: {
      nrr_above_threshold: nrrOk,
      burn_below_threshold: burnOk,
      activation_rising: activationRising,
      sales_cycle_compressing: cycleCompressing,
    },
  };
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function zeroResult(): CriticalityResult {
  return {
    flywheel_score: 0,
    auto_catalytic: false,
    conditions: {
      nrr_above_threshold: false,
      burn_below_threshold: false,
      activation_rising: false,
      sales_cycle_compressing: false,
    },
  };
}
