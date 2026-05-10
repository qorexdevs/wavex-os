/**
 * The 5 canonical bundle workflows from OPΩ-SPEC §4.
 *
 * These are static definitions — they don't vary per-operator. The
 * participating_agents list is filtered by swarm_manifest (only agents
 * that are active in the target swarm are retained in each bundle).
 */

import type { BundleId } from "@op-omega/plugin-flywheel-kernel";
import type { BundleWorkflow } from "../../schema/workflow-manifest.js";

// @tunable phase4.canonical_bundle_workflows
export const CANONICAL_BUNDLE_WORKFLOWS: Record<BundleId, BundleWorkflow> = {
  insight_activation: {
    owner: "cpo.growth",
    cycle_length: "24h",
    participating_agents: [
      "cdo.signal",
      "cpo.build",
      "cdo.telemetry",
      "cmo.content",
      "cdo.signal", // second pass to verify lift
    ],
    kpis_moved: ["activation_rate", "ttv_hours", "nrr"],
  },
  pipeline_velocity: {
    owner: "cro.chief",
    cycle_length: "1w",
    participating_agents: [
      "cmo.demand",
      "cro.outbound",
      "cro.demo",
      "cro.close",
      "cdo.attribute",
      "cfo.capital",
    ],
    kpis_moved: ["cac", "sales_cycle_days", "win_rate", "mrr"],
  },
  expansion_engine: {
    owner: "cro.expansion",
    cycle_length: "per-account",
    participating_agents: [
      "cdo.telemetry",
      "cro.expansion",
      "cpo.build",
      "cmo.advocacy",
      "cmo.content",
    ],
    kpis_moved: ["nrr", "grr", "referral_rate", "mrr", "inbound_quality"],
  },
  unit_economics: {
    owner: "cfo.capital",
    cycle_length: "1d",
    participating_agents: ["cfo.capital", "cfo.econ", "cdo.telemetry"],
    kpis_moved: ["burn_multiple", "cac_payback_months", "cac"],
  },
  strategic_positioning: {
    owner: "cmo.brand",
    cycle_length: "1mo",
    participating_agents: ["cdo.signal", "cmo.brand", "cpo.build", "cmo.content", "cro.demo"],
    kpis_moved: ["narrative_strength", "inbound_quality", "sales_cycle_days", "win_rate"],
  },
};

/**
 * Filter each canonical bundle's participating_agents to only those that
 * are actually active in the provided swarm. Returns a deep-ish copy so
 * the canonical constant isn't mutated.
 */
export function bundleWorkflowsForSwarm(
  activeAgentIds: ReadonlySet<string>,
): Record<BundleId, BundleWorkflow> {
  const out = {} as Record<BundleId, BundleWorkflow>;
  for (const [bundleId, template] of Object.entries(CANONICAL_BUNDLE_WORKFLOWS) as [
    BundleId,
    BundleWorkflow,
  ][]) {
    const participating = template.participating_agents.filter((a) => activeAgentIds.has(a));
    out[bundleId] = {
      ...template,
      participating_agents: participating,
    };
  }
  return out;
}
