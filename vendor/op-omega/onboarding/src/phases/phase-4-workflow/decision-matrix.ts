/**
 * Phase 4 decision matrix — builds a workflow_manifest from the swarm
 * manifest + connector manifest using per-archetype templates. Acts as the
 * fallback when T2 isn't available, and as the baseline T2 refines.
 */

import { createHash } from "node:crypto";
import type { SwarmManifest } from "../../schema/swarm-manifest.js";
import type { ConnectorManifest } from "../../schema/connector-manifest.js";
import {
  WORKFLOW_MANIFEST_SCHEMA_VERSION,
  type WorkflowManifest,
  type AgentWorkflow,
} from "../../schema/workflow-manifest.js";
import { baselineWorkflowFor, collectDryRunGates } from "./workflow-templates.js";
import { bundleWorkflowsForSwarm } from "./bundle-workflows.js";
import { SCHEDULED_ROUTINES } from "./scheduled-routines.js";

export interface WorkflowDecisionMatrixOptions {
  now?: Date;
  pillarResponsesHash?: string;
  connectorManifestHash?: string;
  swarmManifestHash?: string;
  generatedBy?: string;
}

export function hashSwarmManifest(m: SwarmManifest): string {
  const canon = JSON.stringify({
    schema_version: m.schema_version,
    topology: m.topology,
    agents: m.agents,
    spawn_eligibility: m.spawn_eligibility,
    bundle_allocation_initial: m.bundle_allocation_initial,
  });
  return `sha256:${createHash("sha256").update(canon).digest("hex")}`;
}

export function runWorkflowDecisionMatrix(
  swarm: SwarmManifest,
  connectors: ConnectorManifest,
  options: WorkflowDecisionMatrixOptions = {},
): WorkflowManifest {
  const now = options.now ?? new Date();
  const configuredConnectors = new Set(
    [...connectors.required, ...connectors.suggested].map((e) => e.id),
  );
  const activeAgentIds = new Set<string>();

  const agent_workflows: Record<string, AgentWorkflow> = {};
  for (const [id, agent] of Object.entries(swarm.agents)) {
    if (agent.status !== "active") continue;
    activeAgentIds.add(id);
    const workflow = baselineWorkflowFor(id, agent);

    // Strip connector-dependent tasks whose connector isn't in the manifest.
    workflow.on_fire = workflow.on_fire.map((task) => {
      if (task.connector && !configuredConnectors.has(task.connector)) {
        return { ...task, connector: null, dry_run_gate: true };
      }
      return task;
    });
    agent_workflows[id] = workflow;
  }

  const bundle_workflows = bundleWorkflowsForSwarm(activeAgentIds);
  const dry_run_gates = collectDryRunGates(agent_workflows);

  return {
    schema_version: WORKFLOW_MANIFEST_SCHEMA_VERSION,
    generated_at: now.toISOString(),
    generated_by: options.generatedBy ?? "T0 · decision-matrix-fallback",
    based_on: {
      pillar_responses_hash: options.pillarResponsesHash ?? "",
      connector_manifest_hash: options.connectorManifestHash ?? "",
      swarm_manifest_hash: options.swarmManifestHash ?? "",
    },
    agent_workflows,
    bundle_workflows,
    scheduled_routines_enabled: { ...SCHEDULED_ROUTINES },
    dry_run_gates,
  };
}
