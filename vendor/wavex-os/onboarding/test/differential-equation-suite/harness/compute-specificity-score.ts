/**
 * OPΩ-ONB-TEST-001-rev2 · Appendix §6 · Step 4
 *
 * Specificity scoring for Suite 4 · Inference Value.
 *
 *   Rationale specificity   = operator-specific tokens per rationale string
 *   Workflow patch coverage = agents with non-baseline on_fire sequences
 *   Skill overlay specificity = % of overlays that reference pillar text
 *
 * Operator-specific tokens are extracted from the pillar responses and used
 * as anchors — an "operator-specific rationale" must mention at least one of
 * them. The metric is count per rationale, averaged across all rationales.
 */

import type {
  ConnectorManifest,
  PillarResponses,
  SwarmManifest,
  WorkflowManifest,
} from "../../../src/index.js";
import { baselineWorkflowFor } from "../../../src/phases/phase-4-workflow/workflow-templates.js";

export interface SpecificityScores {
  rationale_specificity: number;         // avg tokens/rationale
  workflow_patch_coverage: number;        // # agents with non-baseline on_fire
  skill_overlay_specificity: number;      // absolute # overlays referencing operator text
  total_rationales_scanned: number;
  total_overlays_scanned: number;
  total_workflows_scanned: number;
}

const STOP_WORDS = new Set([
  "the", "a", "an", "of", "and", "or", "but", "for", "to", "in", "on", "at", "by", "with",
  "is", "are", "was", "were", "be", "been", "being",
  "this", "that", "these", "those", "it", "its",
  "we", "our", "us", "you", "your", "they", "their",
  "has", "have", "had", "will", "would", "can", "could", "should",
  "not", "no", "so", "as", "if", "than", "then",
  "sec", "sub", "hr", "min",
]);

/**
 * Build the "operator-specific token" set from pillar responses. These are
 * the anchors a rationale / overlay needs to mention to count as specific.
 */
export function extractOperatorTokens(responses: PillarResponses): Set<string> {
  const tokens = new Set<string>();

  const push = (value: string | null | undefined): void => {
    if (!value) return;
    for (const raw of value.split(/[\s,.()\-_/]+/)) {
      const tok = raw.toLowerCase().trim();
      if (tok.length < 3) continue;
      if (STOP_WORDS.has(tok)) continue;
      if (!/[a-z]/i.test(tok)) continue;
      tokens.add(tok);
    }
  };

  if (responses.pillar_1) {
    push(responses.pillar_1.org_name);
    push(responses.pillar_1.company_context);
    push(responses.pillar_1.industry_hint);
    push(responses.pillar_1.business_model_hint);
  }
  if (responses.pillar_3) {
    push(responses.pillar_3.product_state);
    push(responses.pillar_3.stage);
  }
  if (responses.pillar_4) {
    for (const ls of responses.pillar_4.lead_sources ?? []) push(ls);
    if (responses.pillar_4.lead_source) push(responses.pillar_4.lead_source);
    push(responses.pillar_4.sales_motion);
    push(responses.pillar_4.close_channel);
    push(responses.pillar_4.gtm_profile_enum);
  }
  if (responses.pillar_5) {
    push(responses.pillar_5.comm_channel);
    push(responses.pillar_5.urgency_routing);
  }

  return tokens;
}

function countAnchors(text: string, anchors: Set<string>): number {
  const lower = text.toLowerCase();
  let c = 0;
  for (const a of anchors) {
    if (a.length < 3) continue;
    // Substring match — cheap and robust to punctuation / inflection.
    if (lower.includes(a)) c += 1;
  }
  return c;
}

export function scoreRationaleSpecificity(
  manifests: {
    connector: ConnectorManifest;
    swarm: SwarmManifest;
    workflow: WorkflowManifest;
  },
  anchors: Set<string>,
): { avg: number; total_rationales: number } {
  let totalTokens = 0;
  let count = 0;

  for (const entry of [...manifests.connector.required, ...manifests.connector.suggested, ...manifests.connector.deferred]) {
    totalTokens += countAnchors(entry.rationale, anchors);
    count += 1;
  }
  for (const e of manifests.swarm.spawn_eligibility) {
    totalTokens += countAnchors(e.rationale, anchors);
    count += 1;
  }

  return {
    avg: count === 0 ? 0 : Math.round((totalTokens / count) * 100) / 100,
    total_rationales: count,
  };
}

export function scoreSkillOverlaySpecificity(
  swarm: SwarmManifest,
  anchors: Set<string>,
): { anchored: number; pct: number; total_overlays: number } {
  const overlays = Object.values(swarm.agents)
    .map((a) => a.skill_overlay)
    .filter((s): s is string => typeof s === "string" && s.length > 0);

  if (overlays.length === 0) return { anchored: 0, pct: 0, total_overlays: 0 };

  let hits = 0;
  for (const o of overlays) {
    if (countAnchors(o, anchors) > 0) hits += 1;
  }
  return {
    anchored: hits,
    pct: Math.round((hits / overlays.length) * 10000) / 100,
    total_overlays: overlays.length,
  };
}

/**
 * Workflow patch coverage: count agents whose on_fire task list differs from
 * the known-baseline task sequence for their archetype. For a given agent id,
 * we use the `baselineWorkflowFor()` function to get the baseline, and compare
 * task names (not full task shape — names are the structural fingerprint).
 */
export function scoreWorkflowPatchCoverage(
  workflow: WorkflowManifest,
  swarm: SwarmManifest,
): { patched_agent_count: number; total_workflows: number; patched_agents: string[] } {
  const patched: string[] = [];
  for (const [id, wf] of Object.entries(workflow.agent_workflows)) {
    const swarmAgent = swarm.agents[id];
    if (!swarmAgent) continue;
    const baseline = baselineWorkflowFor(id, swarmAgent);
    const baselineSig = baseline.on_fire.map((t) => t.task).join("|");
    const observedSig = wf.on_fire.map((t) => t.task).join("|");
    if (observedSig !== baselineSig) patched.push(id);
  }
  return {
    patched_agent_count: patched.length,
    total_workflows: Object.keys(workflow.agent_workflows).length,
    patched_agents: patched.sort(),
  };
}

export function computeSpecificityScores(
  responses: PillarResponses,
  connector: ConnectorManifest,
  swarm: SwarmManifest,
  workflow: WorkflowManifest,
): SpecificityScores {
  const anchors = extractOperatorTokens(responses);
  const rat = scoreRationaleSpecificity({ connector, swarm, workflow }, anchors);
  const overlay = scoreSkillOverlaySpecificity(swarm, anchors);
  const patch = scoreWorkflowPatchCoverage(workflow, swarm);
  return {
    rationale_specificity: rat.avg,
    workflow_patch_coverage: patch.patched_agent_count,
    skill_overlay_specificity: overlay.anchored,
    total_rationales_scanned: rat.total_rationales,
    total_overlays_scanned: overlay.total_overlays,
    total_workflows_scanned: patch.total_workflows,
  };
}
