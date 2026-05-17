import type { PillarResponses } from "../../schema/pillar-responses.js";
import type { ConnectorManifest } from "../../schema/connector-manifest.js";
import type { SwarmManifest } from "../../schema/swarm-manifest.js";

export function buildPhase3Prompt(
  responses: PillarResponses,
  connectors: ConnectorManifest,
  baseline: SwarmManifest,
): string {
  return `You are generating Phase 3 of Operator Ω onboarding: the swarm_manifest.

CONTEXT
Pillar responses:
${JSON.stringify(
  {
    pillar_1: {
      org_name: responses.pillar_1?.org_name,
      has_product: responses.pillar_1?.has_product,
      industry_hint: responses.pillar_1?.industry_hint,
      ideal_customer_profile: responses.pillar_1?.ideal_customer_profile,
      revenue_model: responses.pillar_1?.revenue_model,
      competitive_position: responses.pillar_1?.competitive_position,
      primary_acquisition_channel: responses.pillar_1?.primary_acquisition_channel,
      product_maturity_signal: responses.pillar_1?.product_maturity_signal,
      tone_signal: responses.pillar_1?.tone_signal,
      primary_friction_hypothesis: responses.pillar_1?.primary_friction_hypothesis,
      differentiator_hypothesis: responses.pillar_1?.differentiator_hypothesis,
    },
    pillar_3: {
      product_state: responses.pillar_3?.product_state,
      stage: responses.pillar_3?.stage,
    },
    pillar_4: responses.pillar_4,
    pillar_5: { comm_channel: responses.pillar_5?.comm_channel },
  },
  null,
  2,
)}

Connector manifest (required + suggested):
${JSON.stringify(
  {
    required: connectors.required.map((e) => e.id),
    suggested: connectors.suggested.map((e) => e.id),
    deferred: connectors.deferred.map((e) => e.id),
  },
  null,
  2,
)}

BASELINE swarm manifest (rule-based):
${JSON.stringify(
  {
    topology: baseline.topology,
    agents: Object.fromEntries(
      Object.entries(baseline.agents).map(([id, e]) => [
        id,
        { status: e.status, skill_overlay: e.skill_overlay, unpark_condition: e.unpark_condition, reason: e.reason },
      ]),
    ),
    spawn_eligibility: baseline.spawn_eligibility,
    bundle_allocation_initial: baseline.bundle_allocation_initial,
  },
  null,
  2,
)}

YOUR JOB
Review the baseline and return a revised version as JSON. Specifically:
1. Sharpen skill_overlay text so it reflects the operator's specific org (reference org_name / product / GTM).
2. Flag any obvious mis-statuses — an agent marked active when it has no data to consume, or disabled when a connector arrived.
3. Keep spawnable markers only on agents whose queue would plausibly justify spawning in the first 30 cycles.

CONSTRAINTS
- Use ONLY agent ids that exist in the baseline. Do not invent new agents.
- DO NOT modify agent statuses. Each agent's active/parked/disabled state is computed deterministically from pillar signals and is authoritative. Echo statuses unchanged.
- DO NOT modify bundle_allocation_initial. The baseline weights are computed deterministically from pillar signals and are authoritative. Echo them unchanged.
- Your only edit surface is skill_overlay text — sharpen it to reference the operator's specific context (org_name, stage, GTM, ICP).
- Keep ceo.orchestrator and all six chiefs active (these are load-bearing).

OUTPUT
Return ONLY a JSON object with the SAME SHAPE as the baseline. No markdown, no explanation.`;
}
