/**
 * Operator Ω · bifurcation B(C) engine (OPΩ-SPEC §5.4).
 *
 *   B(C) = (queue_depth × task_heterogeneity × opportunity_cost) / attention_capacity
 *
 * Spawn when B > θ_spawn sustained ≥ 3 cycles AND cfo.marginal_roi > 0
 *             AND coo.can_afford_inference == true
 * Reabsorb when B < θ_merge sustained ≥ 5 cycles OR sunset elapsed
 */

import type { BifurcationInput, BifurcationResult } from "./types.js";

export interface BifurcationOptions {
  theta_spawn?: number;
  theta_merge?: number;
  /** Cycles the signal must hold to warrant a spawn recommendation. */
  spawn_persistence?: number;
  /** Cycles the signal must hold low to warrant reabsorption. */
  merge_persistence?: number;
}

export function bifurcate(input: BifurcationInput, options: BifurcationOptions = {}): BifurcationResult {
  const theta_spawn = options.theta_spawn ?? 1.8;
  const theta_merge = options.theta_merge ?? 0.6;
  const spawnPersistence = options.spawn_persistence ?? 3;
  const mergePersistence = options.merge_persistence ?? 5;

  if (input.attention_capacity <= 0) {
    return {
      b_of_c: Number.POSITIVE_INFINITY,
      spawn_recommended: false,
      reabsorb_recommended: false,
      rationale: "attention_capacity must be > 0",
      thresholds: { theta_spawn, theta_merge },
    };
  }

  const latest = computeB(
    last(input.queue_depth_history),
    last(input.task_heterogeneity_history),
    input.opportunity_cost,
    input.attention_capacity,
  );

  const persistentAbove = countSustained(
    input.queue_depth_history,
    input.task_heterogeneity_history,
    input.opportunity_cost,
    input.attention_capacity,
    (b) => b > theta_spawn,
  );
  const persistentBelow = countSustained(
    input.queue_depth_history,
    input.task_heterogeneity_history,
    input.opportunity_cost,
    input.attention_capacity,
    (b) => b < theta_merge,
  );

  const spawn = persistentAbove >= spawnPersistence;
  const merge = persistentBelow >= mergePersistence;

  let rationale: string;
  if (spawn) {
    rationale = `B(C)=${latest.toFixed(2)} > θ_spawn=${theta_spawn} sustained ${persistentAbove} cycles; cfo + coo gating still required.`;
  } else if (merge) {
    rationale = `B(C)=${latest.toFixed(2)} < θ_merge=${theta_merge} sustained ${persistentBelow} cycles → reabsorb.`;
  } else if (latest > theta_spawn) {
    rationale = `B(C)=${latest.toFixed(2)} above spawn threshold but only sustained ${persistentAbove}/${spawnPersistence} cycles.`;
  } else if (latest < theta_merge) {
    rationale = `B(C)=${latest.toFixed(2)} below merge threshold but only sustained ${persistentBelow}/${mergePersistence} cycles.`;
  } else {
    rationale = `B(C)=${latest.toFixed(2)} within steady band; no action.`;
  }

  return {
    b_of_c: latest,
    spawn_recommended: spawn,
    reabsorb_recommended: merge,
    rationale,
    thresholds: { theta_spawn, theta_merge },
  };
}

function computeB(qd: number, het: number, oc: number, cap: number): number {
  return (qd * het * oc) / cap;
}

function last<T>(arr: readonly T[]): T {
  return arr[arr.length - 1];
}

function countSustained(
  qd: readonly number[],
  het: readonly number[],
  oc: number,
  cap: number,
  predicate: (b: number) => boolean,
): number {
  const n = Math.min(qd.length, het.length);
  let count = 0;
  for (let i = n - 1; i >= 0; i--) {
    const b = computeB(qd[i], het[i], oc, cap);
    if (predicate(b)) count += 1;
    else break;
  }
  return count;
}
