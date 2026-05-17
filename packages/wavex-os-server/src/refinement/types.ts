/** Refinement change types — the structured diff produced by the analyze
 *  step and consumed by the apply step. T2 emits these as JSON with stable
 *  ids so the UI can render checkboxes and the apply step can target each
 *  change without re-running the entire phase generator. */

export type ChangeAction =
  // Connectors
  | "connector_add"     // insert a new connector entry (target: bucket)
  | "connector_promote" // move existing entry up (deferred→suggested or suggested→required)
  // Swarm
  | "swarm_overlay"     // rewrite an agent's skill_overlay text (target: slot)
  // Workflows
  | "workflow_task_add"     // append a task to an agent's on_fire array
  | "workflow_escalation_add"; // add an escalation route to an agent

export interface ChangeBase {
  id: string;             // stable identifier the UI uses to select / dedupe
  action: ChangeAction;
  rationale: string;      // ≤200 chars — operator-readable
  pillar_signal?: string; // optional — which pillar field justifies this
}

export interface ConnectorAddChange extends ChangeBase {
  action: "connector_add";
  connector_id: string;       // must exist in the registry (validated server-side)
  bucket: "required" | "suggested" | "deferred";
  priority: "P-1" | "P0" | "P1" | "P2";
}

export interface ConnectorPromoteChange extends ChangeBase {
  action: "connector_promote";
  connector_id: string;
  from_bucket: "deferred" | "suggested";
  to_bucket: "suggested" | "required";
}

export interface SwarmOverlayChange extends ChangeBase {
  action: "swarm_overlay";
  slot: string;            // agent slot id, must exist in swarm.agents
  new_overlay: string;     // ≤500 chars
}

export interface WorkflowTaskAddChange extends ChangeBase {
  action: "workflow_task_add";
  slot: string;            // active agent in swarm
  task: {
    task: string;
    tier?: "T0" | "T1" | "T2";
    flow_type?: "ASN" | "TLM" | "CON" | "VAL";
    connector?: string | null;
    input?: string;
    expected_output?: string;
    dry_run_gate?: boolean;
  };
}

export interface WorkflowEscalationAddChange extends ChangeBase {
  action: "workflow_escalation_add";
  slot: string;
  on: string;
  to: string;
}

export type Change =
  | ConnectorAddChange
  | ConnectorPromoteChange
  | SwarmOverlayChange
  | WorkflowTaskAddChange
  | WorkflowEscalationAddChange;

export interface AnalyzeResult {
  ok: true;
  imprint_only: boolean;
  changes: Change[];
  rationale_summary: string;
}

export interface RefinementHistoryEntry {
  ts: string;                          // ISO timestamp
  guidance: string;                    // operator's guidance text
  applied_change_ids: string[];
  regenerated_imprint: boolean;
  sha256_before: string;
  sha256_after: string;
  manifest_snapshot: unknown;          // full pre-apply manifest for revert
}
