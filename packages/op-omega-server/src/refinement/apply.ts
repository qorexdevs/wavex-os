/** Surgical change-application against an in-memory CompanyManifest.
 *  Returns a list of warnings for changes that couldn't be applied cleanly
 *  (e.g. swarm_overlay against a slot that was activated then de-activated
 *  between analyze and apply). Throws nothing — best-effort + warnings. */

import type { CompanyManifest } from "@op-omega/plugin-onboarding";
import type {
  Change, ConnectorAddChange, ConnectorPromoteChange,
  SwarmOverlayChange, WorkflowTaskAddChange, WorkflowEscalationAddChange,
} from "./types.js";

export function applyChanges(
  manifest: CompanyManifest,
  changes: Change[],
): { applied: Change[]; warnings: string[] } {
  const applied: Change[] = [];
  const warnings: string[] = [];

  for (const change of changes) {
    try {
      switch (change.action) {
        case "connector_add":
          applyConnectorAdd(manifest, change);
          applied.push(change);
          break;
        case "connector_promote":
          if (applyConnectorPromote(manifest, change, warnings)) applied.push(change);
          break;
        case "swarm_overlay":
          if (applySwarmOverlay(manifest, change, warnings)) applied.push(change);
          break;
        case "workflow_task_add":
          if (applyWorkflowTaskAdd(manifest, change, warnings)) applied.push(change);
          break;
        case "workflow_escalation_add":
          if (applyWorkflowEscalationAdd(manifest, change, warnings)) applied.push(change);
          break;
      }
    } catch (e) {
      warnings.push(`change ${change.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { applied, warnings };
}

function applyConnectorAdd(manifest: CompanyManifest, change: ConnectorAddChange): void {
  const entry = {
    id: change.connector_id,
    priority: change.priority,
    rationale: change.rationale,
    status: "pending_decision" as const,
  };
  const list = manifest.connector_manifest[change.bucket];
  // De-dupe: skip if already in the target bucket
  if (list.some((e) => e.id === change.connector_id)) return;
  list.push(entry);
}

function applyConnectorPromote(
  manifest: CompanyManifest,
  change: ConnectorPromoteChange,
  warnings: string[],
): boolean {
  const from = manifest.connector_manifest[change.from_bucket];
  const idx = from.findIndex((e) => e.id === change.connector_id);
  if (idx < 0) {
    warnings.push(`connector_promote ${change.id}: ${change.connector_id} no longer in ${change.from_bucket}; skipped`);
    return false;
  }
  const [entry] = from.splice(idx, 1);
  // Update rationale + bump priority slightly when promoting to required
  entry.rationale = change.rationale;
  if (change.to_bucket === "required" && entry.priority === "P2") entry.priority = "P0";
  if (change.to_bucket === "suggested" && entry.priority === "P2") entry.priority = "P1";
  manifest.connector_manifest[change.to_bucket].push(entry);
  return true;
}

function applySwarmOverlay(
  manifest: CompanyManifest,
  change: SwarmOverlayChange,
  warnings: string[],
): boolean {
  const agent = manifest.swarm_manifest.agents[change.slot];
  if (!agent) {
    warnings.push(`swarm_overlay ${change.id}: slot "${change.slot}" not found; skipped`);
    return false;
  }
  agent.skill_overlay = change.new_overlay;
  return true;
}

function applyWorkflowTaskAdd(
  manifest: CompanyManifest,
  change: WorkflowTaskAddChange,
  warnings: string[],
): boolean {
  const wf = manifest.workflow_manifest.agent_workflows[change.slot];
  if (!wf) {
    warnings.push(`workflow_task_add ${change.id}: slot "${change.slot}" has no workflow; skipped`);
    return false;
  }
  wf.on_fire.push(change.task);
  // If the new task is a write that should be dry-run-gated, also append to manifest.dry_run_gates
  if (change.task.dry_run_gate) {
    const gateId = `${change.slot}.${change.task.task.slice(0, 50)}`;
    if (!manifest.workflow_manifest.dry_run_gates.includes(gateId)) {
      manifest.workflow_manifest.dry_run_gates.push(gateId);
    }
  }
  return true;
}

function applyWorkflowEscalationAdd(
  manifest: CompanyManifest,
  change: WorkflowEscalationAddChange,
  warnings: string[],
): boolean {
  const wf = manifest.workflow_manifest.agent_workflows[change.slot];
  if (!wf) {
    warnings.push(`workflow_escalation_add ${change.id}: slot "${change.slot}" has no workflow; skipped`);
    return false;
  }
  wf.escalation.push({ on: change.on, to: change.to });
  return true;
}
