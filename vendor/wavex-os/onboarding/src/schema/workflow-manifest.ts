/**
 * Phase 4 output — workflow_manifest.yaml schema (OPΩ-ONB-002 §F).
 *
 * Describes the runtime shape of the swarm: per-agent task sequences fired
 * on heartbeat, bundle-level cycle choreography, scheduled routines, and the
 * dry_run_gates enumeration — the single list the runtime consults before
 * any write actually happens.
 */

import type { BundleId } from "@wavex-os/plugin-flywheel-kernel";

export const WORKFLOW_MANIFEST_SCHEMA_VERSION = "1.0";

export type WorkflowTier = "T0" | "T1" | "T2";
export type FlowType = "ASN" | "TLM" | "CON" | "VAL";

export interface WorkflowTask {
  task: string;
  tier?: WorkflowTier;
  /** Connector id this task reads from or writes to (if any). */
  connector?: string | null;
  flow_type?: FlowType;
  /** Name of the upstream artifact this task consumes. */
  input?: string;
  /** Name of the artifact this task produces. */
  expected_output?: string;
  /** When true, this task is subject to the 14-day dry_run gate. */
  dry_run_gate?: boolean;
  /** For ASN tasks routing to another agent. */
  target?: string;
}

export interface EscalationTrigger {
  on: string;
  to: string;
}

export interface AgentWorkflow {
  heartbeat: string;
  on_fire: WorkflowTask[];
  escalation: EscalationTrigger[];
}

export interface BundleWorkflow {
  owner: string;
  cycle_length: string;
  participating_agents: string[];
  kpis_moved: string[];
}

/**
 * Attribution record for a single T2 patch applied to an agent's workflow.
 * Persisted to the manifest so the operator + the audit trail can see what
 * changed, why, and which pillar signal drove it.
 */
export interface T2PatchRecord {
  agent_id: string;
  /** Which fields of the AgentWorkflow were modified (e.g. `["on_fire"]`). */
  changed_fields: string[];
  /** One-sentence explanation referencing the operator's specific context. */
  rationale: string;
  /** Which pillar signal justified the patch (e.g. `"pillar_4.gtm_profile_enum=INBOUND_MID_TOUCH"`). */
  pillar_signal: string;
}

export interface WorkflowManifest {
  schema_version: typeof WORKFLOW_MANIFEST_SCHEMA_VERSION;
  generated_at: string;
  generated_by: string;
  based_on: {
    pillar_responses_hash: string;
    connector_manifest_hash: string;
    swarm_manifest_hash: string;
  };
  agent_workflows: Record<string, AgentWorkflow>;
  bundle_workflows: Record<BundleId, BundleWorkflow>;
  /** name → cron spec (Paperclip-compatible). */
  scheduled_routines_enabled: Record<string, string>;
  /** Flat list of `{agent}.{task}` identifiers that must stay dry during the 14-day window. */
  dry_run_gates: string[];
  /** Per-agent attribution for each T2 patch. Empty if T2 wasn't invoked or returned no valid patches. */
  t2_patches?: T2PatchRecord[];
}
