/**
 * OPΩ-ONB-TEST-001-rev2 · Appendix §6 · Step 3
 *
 * Structural diff between two pipeline-run results. Output shape matches
 * Appendix §5's `ManifestDiff` — used by Suites 1 (divergence) and 4
 * (inference value comparison).
 */

import type {
  ConnectorManifest,
  ConnectorEntry,
  SwarmManifest,
  WorkflowManifest,
} from "../../../src/index.js";
import type { BundleAllocation, BundleId } from "@wavex-os/plugin-flywheel-kernel";

export interface ManifestDiff {
  connectors_diff: {
    added: string[];           // in B, not in A (required ∪ suggested)
    removed: string[];          // in A, not in B
    moved_priority: Array<{ id: string; from: string; to: string }>;
    required_added: string[];
    required_removed: string[];
    suggested_added: string[];
    suggested_removed: string[];
  };
  agents_diff: {
    status_changed: Array<{ agent: string; from: string; to: string }>;
    spawn_eligibility_changed: Array<{ agent: string; gained_or_lost: "gained" | "lost" }>;
  };
  allocations_diff: {
    l1_distance: number;
    per_bundle: Record<BundleId, number>;
  };
  workflows_diff: {
    agents_patched_a_only: string[];
    agents_patched_b_only: string[];
    agents_patched_both: string[];
    dry_run_gates_added: string[];
    dry_run_gates_removed: string[];
  };
}

function bucketIds(m: ConnectorManifest): {
  required: Set<string>;
  suggested: Set<string>;
  byId: Map<string, ConnectorEntry & { bucket: "required" | "suggested" | "deferred" }>;
} {
  const byId = new Map<string, ConnectorEntry & { bucket: "required" | "suggested" | "deferred" }>();
  for (const e of m.required) byId.set(e.id, { ...e, bucket: "required" });
  for (const e of m.suggested) byId.set(e.id, { ...e, bucket: "suggested" });
  for (const e of m.deferred) byId.set(e.id, { ...e, bucket: "deferred" });
  return {
    required: new Set(m.required.map((e) => e.id)),
    suggested: new Set(m.suggested.map((e) => e.id)),
    byId,
  };
}

export function diffConnectors(a: ConnectorManifest, b: ConnectorManifest): ManifestDiff["connectors_diff"] {
  const ab = bucketIds(a);
  const bb = bucketIds(b);

  const added: string[] = [];
  const removed: string[] = [];
  const moved_priority: Array<{ id: string; from: string; to: string }> = [];

  const allIds = new Set([...ab.byId.keys(), ...bb.byId.keys()]);
  for (const id of allIds) {
    const inA = ab.byId.get(id);
    const inB = bb.byId.get(id);
    if (!inA && inB) added.push(id);
    else if (inA && !inB) removed.push(id);
    else if (inA && inB && inA.bucket !== inB.bucket) {
      moved_priority.push({ id, from: inA.bucket, to: inB.bucket });
    }
  }

  return {
    added: added.sort(),
    removed: removed.sort(),
    moved_priority: moved_priority.sort((x, y) => x.id.localeCompare(y.id)),
    required_added: [...bb.required].filter((id) => !ab.required.has(id)).sort(),
    required_removed: [...ab.required].filter((id) => !bb.required.has(id)).sort(),
    suggested_added: [...bb.suggested].filter((id) => !ab.suggested.has(id)).sort(),
    suggested_removed: [...ab.suggested].filter((id) => !bb.suggested.has(id)).sort(),
  };
}

export function diffAgents(a: SwarmManifest, b: SwarmManifest): ManifestDiff["agents_diff"] {
  const status_changed: Array<{ agent: string; from: string; to: string }> = [];
  const spawn_eligibility_changed: Array<{ agent: string; gained_or_lost: "gained" | "lost" }> = [];

  const allIds = new Set([...Object.keys(a.agents), ...Object.keys(b.agents)]);
  for (const id of allIds) {
    const ea = a.agents[id];
    const eb = b.agents[id];
    if (!ea || !eb) continue; // roster shape diffs are a separate concern; ignored here
    if (ea.status !== eb.status) {
      status_changed.push({ agent: id, from: ea.status, to: eb.status });
    }
    if (ea.spawnable !== eb.spawnable) {
      spawn_eligibility_changed.push({ agent: id, gained_or_lost: eb.spawnable ? "gained" : "lost" });
    }
  }

  return {
    status_changed: status_changed.sort((x, y) => x.agent.localeCompare(y.agent)),
    spawn_eligibility_changed: spawn_eligibility_changed.sort((x, y) => x.agent.localeCompare(y.agent)),
  };
}

export function diffAllocations(a: SwarmManifest, b: SwarmManifest): ManifestDiff["allocations_diff"] {
  const keys: BundleId[] = [
    "insight_activation",
    "pipeline_velocity",
    "expansion_engine",
    "unit_economics",
    "strategic_positioning",
  ];
  const per_bundle = {} as Record<BundleId, number>;
  let total = 0;
  for (const k of keys) {
    const av = a.bundle_allocation_initial[k] ?? 0;
    const bv = b.bundle_allocation_initial[k] ?? 0;
    const d = Math.abs(av - bv);
    per_bundle[k] = Math.round(d * 1000) / 1000;
    total += d;
  }
  return {
    l1_distance: Math.round(total * 1000) / 1000,
    per_bundle,
  };
}

function patchedAgentSet(a: WorkflowManifest): Set<string> {
  // A workflow counts as "patched" if its agent's skill_overlay is non-null
  // OR its generated_by is T2 (the manifest-level flag). For fine-grained
  // detection, we compare task signatures.
  // Heuristic: an agent is patched if any task.task string contains underscores
  // other than the baseline template names — or more simply, if the generated
  // manifest's generated_by === "T2 · onboarding/phase-4".
  // For diffing we just return all agents' ids that appear in both manifests;
  // the "patched_a_only" / "patched_b_only" buckets are resolved by set diff.
  return new Set(Object.keys(a.agent_workflows));
}

export function diffWorkflows(a: WorkflowManifest, b: WorkflowManifest): ManifestDiff["workflows_diff"] {
  const aAgents = patchedAgentSet(a);
  const bAgents = patchedAgentSet(b);

  // Per-agent task-signature comparison: an agent is "patched differently"
  // if its on_fire task names differ.
  const agents_patched_a_only: string[] = [];
  const agents_patched_b_only: string[] = [];
  const agents_patched_both: string[] = [];

  for (const id of new Set([...aAgents, ...bAgents])) {
    const wa = a.agent_workflows[id];
    const wb = b.agent_workflows[id];
    if (!wa && wb) agents_patched_b_only.push(id);
    else if (wa && !wb) agents_patched_a_only.push(id);
    else if (wa && wb) {
      const sigA = wa.on_fire.map((t) => t.task).join("|");
      const sigB = wb.on_fire.map((t) => t.task).join("|");
      if (sigA !== sigB) agents_patched_both.push(id);
    }
  }

  const aGates = new Set(a.dry_run_gates);
  const bGates = new Set(b.dry_run_gates);
  const dry_run_gates_added = [...bGates].filter((g) => !aGates.has(g)).sort();
  const dry_run_gates_removed = [...aGates].filter((g) => !bGates.has(g)).sort();

  return {
    agents_patched_a_only: agents_patched_a_only.sort(),
    agents_patched_b_only: agents_patched_b_only.sort(),
    agents_patched_both: agents_patched_both.sort(),
    dry_run_gates_added,
    dry_run_gates_removed,
  };
}

export function computeManifestDiff(
  a: { connectorManifest: ConnectorManifest; swarmManifest: SwarmManifest; workflowManifest: WorkflowManifest },
  b: { connectorManifest: ConnectorManifest; swarmManifest: SwarmManifest; workflowManifest: WorkflowManifest },
): ManifestDiff {
  return {
    connectors_diff: diffConnectors(a.connectorManifest, b.connectorManifest),
    agents_diff: diffAgents(a.swarmManifest, b.swarmManifest),
    allocations_diff: diffAllocations(a.swarmManifest, b.swarmManifest),
    workflows_diff: diffWorkflows(a.workflowManifest, b.workflowManifest),
  };
}

export function summarizeDiffMagnitude(d: ManifestDiff): {
  connector_count: number;
  agent_status_count: number;
  allocation_l1: number;
  workflow_changed_count: number;
} {
  return {
    connector_count: d.connectors_diff.added.length + d.connectors_diff.removed.length + d.connectors_diff.moved_priority.length,
    agent_status_count: d.agents_diff.status_changed.length + d.agents_diff.spawn_eligibility_changed.length,
    allocation_l1: d.allocations_diff.l1_distance,
    workflow_changed_count: d.workflows_diff.agents_patched_a_only.length + d.workflows_diff.agents_patched_b_only.length + d.workflows_diff.agents_patched_both.length,
  };
}
