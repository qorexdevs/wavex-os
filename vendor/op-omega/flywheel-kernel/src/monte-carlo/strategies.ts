/**
 * Operator Ω · 5 canonical allocation strategies for Monte Carlo inference.
 *
 * Weights are relative attention allocated to each activity bundle per cycle.
 * Values do not need to sum to 1; the simulator normalizes when applied.
 */

import type { StrategyDefinition } from "../types.js";

export const STRATEGIES: StrategyDefinition[] = [
  {
    id: "RETENTION_FIRST",
    displayName: "Retention First",
    description:
      "Emphasizes expansion_engine and insight_activation — the flywheel edges that compound NRR. Best when MRR base is small but product is sticky.",
    weights: {
      insight_activation: 0.30,
      pipeline_velocity: 0.10,
      expansion_engine: 0.35,
      unit_economics: 0.15,
      strategic_positioning: 0.10,
    },
    risk_profile: "defensive",
  },
  {
    id: "BALANCED",
    displayName: "Balanced",
    description:
      "Equal attention across all five bundles — safe default when there's no signal pointing elsewhere.",
    weights: {
      insight_activation: 0.20,
      pipeline_velocity: 0.20,
      expansion_engine: 0.20,
      unit_economics: 0.20,
      strategic_positioning: 0.20,
    },
    risk_profile: "balanced",
  },
  {
    id: "ACQUISITION_HEAVY",
    displayName: "Acquisition Heavy",
    description:
      "Emphasizes pipeline_velocity over everything. Best when burn allows aggressive CAC spend and the market window is closing.",
    weights: {
      insight_activation: 0.15,
      pipeline_velocity: 0.45,
      expansion_engine: 0.10,
      unit_economics: 0.15,
      strategic_positioning: 0.15,
    },
    risk_profile: "aggressive",
  },
  {
    id: "NARRATIVE_LED",
    displayName: "Narrative Led",
    description:
      "Emphasizes strategic_positioning — invest in brand + thought-leadership so downstream bundles convert better. Slowest to show in KPIs; highest 12-month leverage.",
    weights: {
      insight_activation: 0.15,
      pipeline_velocity: 0.20,
      expansion_engine: 0.15,
      unit_economics: 0.10,
      strategic_positioning: 0.40,
    },
    risk_profile: "balanced",
  },
  {
    id: "CAPITAL_EFFICIENT",
    displayName: "Capital Efficient",
    description:
      "Emphasizes unit_economics — protect burn multiple and payback. Best when runway is tight.",
    weights: {
      insight_activation: 0.15,
      pipeline_velocity: 0.15,
      expansion_engine: 0.15,
      unit_economics: 0.40,
      strategic_positioning: 0.15,
    },
    risk_profile: "defensive",
  },
];

export function getStrategy(id: StrategyDefinition["id"]): StrategyDefinition {
  const s = STRATEGIES.find((x) => x.id === id);
  if (!s) throw new Error(`unknown strategy: ${id}`);
  return s;
}
