/**
 * Phase 3 output — swarm_manifest.yaml schema (OPΩ-ONB-002 §E).
 *
 * Describes the operator's target agent topology: which of the 33-agent
 * base roster are active / parked / disabled, plus spawn-eligibility and
 * initial bundle allocation weights that the MC simulator will use as
 * seed values.
 */

import type { BundleAllocation } from "@op-omega/plugin-flywheel-kernel";

export const SWARM_MANIFEST_SCHEMA_VERSION = "1.0";

export type AgentLevel = "L·II" | "L·III" | "L·IV";
export type AgentDepartment = "board" | "ceo" | "product" | "marketing" | "revenue" | "finance" | "data" | "ops";
/**
 * Agent lifecycle states:
 *   - `active`   — running now, all prerequisites met
 *   - `standby`  — would run, but a required connector isn't wired
 *   - `parked`   — may become relevant later (business evolution)
 *   - `disabled` — structurally not relevant for this operator
 */
export type AgentStatus = "active" | "standby" | "parked" | "disabled";

export interface AgentManifestEntry {
  status: AgentStatus;
  adapter: string;
  heartbeat: string;
  budget_monthly_usd: number;
  skill_overlay: string | null;
  department: AgentDepartment;
  level: AgentLevel;
  reports_to: string | null;
  spawnable: boolean;
  /** Required when status === "parked"; absent otherwise. */
  unpark_condition?: string;
  /** Required when status === "standby"; names the connector that unblocks. */
  waiting_on_connector?: string;
  /** Required when status === "disabled"; absent otherwise. */
  reason?: string;
}

export interface SpawnEligibilityEntry {
  agent: string;
  marker: "S+";
  rationale: string;
}

export interface SwarmTopologySummary {
  total_base_roster: number;
  active_count: number;
  standby_count?: number;
  parked_count: number;
  disabled_count: number;
}

export interface SwarmManifest {
  schema_version: typeof SWARM_MANIFEST_SCHEMA_VERSION;
  generated_at: string;
  generated_by: string;
  based_on: {
    pillar_responses_hash: string;
    connector_manifest_hash: string;
  };
  topology: SwarmTopologySummary;
  agents: Record<string, AgentManifestEntry>;
  spawn_eligibility: SpawnEligibilityEntry[];
  bundle_allocation_initial: BundleAllocation;
}
