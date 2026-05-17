/** Parse + validate the T2 analyze response into a typed AnalyzeResult.
 *  Drops invalid changes silently; returns a warnings list for caller. */

import type {
  AnalyzeResult, Change, ConnectorAddChange, ConnectorPromoteChange,
  SwarmOverlayChange, WorkflowTaskAddChange, WorkflowEscalationAddChange,
} from "./types.js";
import { CONNECTOR_REGISTRY_FOR_REFINEMENT } from "./analyze-prompt.js";

const REGISTRY = new Set(CONNECTOR_REGISTRY_FOR_REFINEMENT);
const VALID_BUCKETS = new Set(["required", "suggested", "deferred"]);
const VALID_PROMOTE_FROM = new Set(["deferred", "suggested"]);
const VALID_PROMOTE_TO = new Set(["suggested", "required"]);
const VALID_PRIORITY = new Set(["P-1", "P0", "P1", "P2"]);
const VALID_TIER = new Set(["T0", "T1", "T2"]);
const VALID_FLOW = new Set(["ASN", "TLM", "CON", "VAL"]);

interface ParseOpts {
  activeSlots: Set<string>;
  baselineRequired: Set<string>;
  baselineSuggested: Set<string>;
  baselineDeferred: Set<string>;
}

export function parseAnalyzeResponse(raw: string, opts: ParseOpts): { result: AnalyzeResult; warnings: string[] } {
  const warnings: string[] = [];

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    return {
      result: { ok: true, imprint_only: true, changes: [], rationale_summary: "T2 returned no JSON; treating as imprint-only refinement." },
      warnings: ["T2 response contained no JSON object"],
    };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(match[0]) as Record<string, unknown>;
  } catch (e) {
    return {
      result: { ok: true, imprint_only: true, changes: [], rationale_summary: "T2 JSON parse failed; treating as imprint-only." },
      warnings: [`JSON parse failed: ${e instanceof Error ? e.message : String(e)}`],
    };
  }

  const imprint_only = Boolean(parsed.imprint_only);
  const rationale_summary = typeof parsed.rationale_summary === "string" ? parsed.rationale_summary.slice(0, 400) : "";
  const rawChanges = Array.isArray(parsed.changes) ? parsed.changes : [];

  const changes: Change[] = [];
  for (const r of rawChanges) {
    if (typeof r !== "object" || r === null) { warnings.push("Skipped non-object change"); continue; }
    const c = r as Record<string, unknown>;
    const id = typeof c.id === "string" ? c.id : null;
    const action = typeof c.action === "string" ? c.action : null;
    const rationale = typeof c.rationale === "string" ? c.rationale.slice(0, 400) : null;
    if (!id || !action || !rationale) { warnings.push(`Skipped change missing id/action/rationale: ${JSON.stringify(c).slice(0, 100)}`); continue; }
    const pillar_signal = typeof c.pillar_signal === "string" ? c.pillar_signal.slice(0, 200) : undefined;

    if (action === "connector_add") {
      const cid = typeof c.connector_id === "string" ? c.connector_id : null;
      const bucket = typeof c.bucket === "string" ? c.bucket : null;
      const priority = typeof c.priority === "string" ? c.priority : null;
      if (!cid || !REGISTRY.has(cid)) { warnings.push(`connector_add ${id}: unknown connector_id "${cid}"`); continue; }
      if (!bucket || !VALID_BUCKETS.has(bucket)) { warnings.push(`connector_add ${id}: invalid bucket "${bucket}"`); continue; }
      if (!priority || !VALID_PRIORITY.has(priority)) { warnings.push(`connector_add ${id}: invalid priority "${priority}"`); continue; }
      // De-dupe: if connector already in any bucket, drop
      if (opts.baselineRequired.has(cid) || opts.baselineSuggested.has(cid) || opts.baselineDeferred.has(cid)) {
        warnings.push(`connector_add ${id}: ${cid} already exists; use connector_promote instead`);
        continue;
      }
      const change: ConnectorAddChange = {
        id, action: "connector_add", rationale, pillar_signal,
        connector_id: cid, bucket: bucket as "required" | "suggested" | "deferred",
        priority: priority as "P-1" | "P0" | "P1" | "P2",
      };
      changes.push(change);
    } else if (action === "connector_promote") {
      const cid = typeof c.connector_id === "string" ? c.connector_id : null;
      const from = typeof c.from_bucket === "string" ? c.from_bucket : null;
      const to = typeof c.to_bucket === "string" ? c.to_bucket : null;
      if (!cid) { warnings.push(`connector_promote ${id}: missing connector_id`); continue; }
      if (!from || !VALID_PROMOTE_FROM.has(from)) { warnings.push(`connector_promote ${id}: invalid from_bucket "${from}"`); continue; }
      if (!to || !VALID_PROMOTE_TO.has(to)) { warnings.push(`connector_promote ${id}: invalid to_bucket "${to}"`); continue; }
      // Validate from_bucket actually contains it
      const inFrom = (from === "deferred" && opts.baselineDeferred.has(cid))
        || (from === "suggested" && opts.baselineSuggested.has(cid));
      if (!inFrom) {
        warnings.push(`connector_promote ${id}: ${cid} not currently in ${from}`);
        continue;
      }
      const change: ConnectorPromoteChange = {
        id, action: "connector_promote", rationale, pillar_signal,
        connector_id: cid,
        from_bucket: from as "deferred" | "suggested",
        to_bucket: to as "suggested" | "required",
      };
      changes.push(change);
    } else if (action === "swarm_overlay") {
      const slot = typeof c.slot === "string" ? c.slot : null;
      const overlay = typeof c.new_overlay === "string" ? c.new_overlay.slice(0, 600) : null;
      if (!slot || !opts.activeSlots.has(slot)) { warnings.push(`swarm_overlay ${id}: unknown active slot "${slot}"`); continue; }
      if (!overlay) { warnings.push(`swarm_overlay ${id}: missing new_overlay`); continue; }
      const change: SwarmOverlayChange = {
        id, action: "swarm_overlay", rationale, pillar_signal,
        slot, new_overlay: overlay,
      };
      changes.push(change);
    } else if (action === "workflow_task_add") {
      const slot = typeof c.slot === "string" ? c.slot : null;
      const task = (c.task && typeof c.task === "object") ? c.task as Record<string, unknown> : null;
      if (!slot || !opts.activeSlots.has(slot)) { warnings.push(`workflow_task_add ${id}: unknown active slot "${slot}"`); continue; }
      if (!task || typeof task.task !== "string") { warnings.push(`workflow_task_add ${id}: missing or invalid task`); continue; }
      const cleanTask: WorkflowTaskAddChange["task"] = { task: task.task.slice(0, 200) };
      if (typeof task.tier === "string" && VALID_TIER.has(task.tier)) cleanTask.tier = task.tier as "T0" | "T1" | "T2";
      if (typeof task.flow_type === "string" && VALID_FLOW.has(task.flow_type)) cleanTask.flow_type = task.flow_type as "ASN" | "TLM" | "CON" | "VAL";
      if (typeof task.connector === "string") cleanTask.connector = task.connector;
      if (task.connector === null) cleanTask.connector = null;
      if (typeof task.input === "string") cleanTask.input = task.input.slice(0, 200);
      if (typeof task.expected_output === "string") cleanTask.expected_output = task.expected_output.slice(0, 200);
      if (typeof task.dry_run_gate === "boolean") cleanTask.dry_run_gate = task.dry_run_gate;
      const change: WorkflowTaskAddChange = {
        id, action: "workflow_task_add", rationale, pillar_signal,
        slot, task: cleanTask,
      };
      changes.push(change);
    } else if (action === "workflow_escalation_add") {
      const slot = typeof c.slot === "string" ? c.slot : null;
      const on = typeof c.on === "string" ? c.on.slice(0, 120) : null;
      const to = typeof c.to === "string" ? c.to : null;
      if (!slot || !opts.activeSlots.has(slot)) { warnings.push(`workflow_escalation_add ${id}: unknown active slot "${slot}"`); continue; }
      if (!on || !to) { warnings.push(`workflow_escalation_add ${id}: missing on/to`); continue; }
      const change: WorkflowEscalationAddChange = {
        id, action: "workflow_escalation_add", rationale, pillar_signal,
        slot, on, to,
      };
      changes.push(change);
    } else {
      warnings.push(`Unknown change action "${action}"`);
    }
  }

  // Cap at 8 changes
  const trimmedChanges = changes.slice(0, 8);
  if (changes.length > 8) {
    warnings.push(`Trimmed ${changes.length - 8} changes (cap is 8 per refinement call)`);
  }

  return {
    result: { ok: true, imprint_only: imprint_only && trimmedChanges.length === 0, changes: trimmedChanges, rationale_summary },
    warnings,
  };
}
