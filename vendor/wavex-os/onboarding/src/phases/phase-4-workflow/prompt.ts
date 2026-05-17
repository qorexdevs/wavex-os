import type { PillarResponses } from "../../schema/pillar-responses.js";
import type { ConnectorManifest } from "../../schema/connector-manifest.js";
import type { SwarmManifest } from "../../schema/swarm-manifest.js";
import type { WorkflowManifest } from "../../schema/workflow-manifest.js";

/**
 * Keep the prompt under ~3k tokens by sending only the active agents' names
 * + their current on_fire sequence. T2 returns a JSON patch with just the
 * agents whose workflows it wants to refine.
 */
export function buildPhase4Prompt(
  responses: PillarResponses,
  connectors: ConnectorManifest,
  swarm: SwarmManifest,
  baseline: WorkflowManifest,
): string {
  const activeAgents = Object.entries(swarm.agents)
    .filter(([, a]) => a.status === "active")
    .map(([id, a]) => ({ id, department: a.department, heartbeat: a.heartbeat }));

  const baselineWorkflows = Object.fromEntries(
    Object.entries(baseline.agent_workflows).map(([id, wf]) => [
      id,
      { on_fire: wf.on_fire.map((t) => ({ task: t.task, tier: t.tier, flow_type: t.flow_type })) },
    ]),
  );

  return `You are generating Phase 4 of Operator Ω onboarding: the workflow_manifest.

CONTEXT
Operator: ${responses.pillar_1?.org_name} (${responses.pillar_3?.product_state} · GTM=${responses.pillar_4?.gtm_profile_enum})
ICP: ${responses.pillar_1?.ideal_customer_profile ?? "unspecified"}
Revenue model: ${responses.pillar_1?.revenue_model ?? "unspecified"}
Primary acquisition: ${responses.pillar_1?.primary_acquisition_channel ?? "unspecified"}
Product maturity: ${responses.pillar_1?.product_maturity_signal ?? "unspecified"}
Tone: ${responses.pillar_1?.tone_signal ?? "unspecified"}
Primary friction: ${responses.pillar_1?.primary_friction_hypothesis ?? "unspecified"}
Differentiator: ${responses.pillar_1?.differentiator_hypothesis ?? "unspecified"}
Active agents (${activeAgents.length}):
${JSON.stringify(activeAgents, null, 2)}

Connectors configured: ${[...connectors.required, ...connectors.suggested].map((c) => c.id).join(", ")}

BASELINE workflows (tasks only, for context):
${JSON.stringify(baselineWorkflows, null, 2)}

YOUR JOB
Review the baseline and return a JSON PATCH — only the agents whose workflows should be refined. EVERY patch MUST include a rationale referencing a specific operator signal. The patch shape is:
{
  "patches": [
    {
      "agent_id": "<one of the active agents above>",
      "changed_fields": ["on_fire"] | ["escalation"] | ["on_fire", "escalation"],
      "rationale": "One sentence explaining what you changed and why, referencing operator context (org name, GTM, stage, product, or primary acquisition channel).",
      "pillar_signal": "pillar_N.field=value — the specific signal justifying this patch",
      "on_fire": [ { "task": "...", "tier": "T0|T1|T2", "flow_type": "ASN|TLM|CON|VAL", "dry_run_gate": bool, "connector": "id|null", "input": "...", "expected_output": "..." }, ... ],
      "escalation": [ { "on": "...", "to": "..." }, ... ]
    }
  ]
}

RULES
- Only patch agents whose baseline is plainly generic for the operator's situation. Leave the rest alone.
- Never invent new agent ids. Use only the ones in the "Active agents" list above.
- tier must be T0 | T1 | T2. flow_type must be ASN | TLM | CON | VAL.
- Every task that writes externally (publishes content, sends messages, modifies customer records, enforces budgets) must have dry_run_gate: true.
- Keep each on_fire sequence ≤ 6 tasks.
- A patch without a specific rationale and pillar_signal will be DISCARDED. Do not emit patches with generic boilerplate like "improved for this operator" — the rationale must name a concrete pillar signal (stage, GTM profile, lead source, product state, ICP, product_maturity, tone, friction, differentiator, etc.).

OUTPUT
Return ONLY a JSON object matching the "patches" shape above. No markdown.`;
}
