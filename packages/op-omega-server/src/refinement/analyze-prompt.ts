/** T2 prompt for refinement analysis.
 *
 *  Input: full company manifest + operator's free-form guidance text.
 *  Output: structured JSON with imprint_only flag + a list of proposed
 *  structural changes (connector_add / connector_promote / swarm_overlay /
 *  workflow_task_add / workflow_escalation_add). Each change must include
 *  rationale and (when applicable) a pillar_signal attribution. */

import type { CompanyManifest } from "@op-omega/plugin-onboarding";

export const CONNECTOR_REGISTRY_FOR_REFINEMENT = [
  // Inference + comms
  "claude-code", "slack", "telegram", "whatsapp", "twilio-sms", "sendgrid", "discord",
  // Data substrate
  "supabase", "segment", "posthog", "mixpanel", "amplitude",
  // Engineering
  "github",
  // Ads + acquisition
  "meta-ads-api", "google-ads-api", "linkedin-sales-nav",
  // Commerce
  "stripe", "stripe-connect", "shopify", "bigcommerce", "shipstation", "klaviyo",
  // CRM + sales
  "hubspot", "salesforce", "intercom", "zendesk", "calendly",
  // Productivity
  "notion", "airtable", "linear", "google_calendar", "google_drive", "gmail",
  // Vertical
  "plaid", "docusign", "clio",
  // AI infra
  "openai", "anthropic",
];

export function buildAnalyzeRefinementPrompt(
  manifest: CompanyManifest,
  operatorGuidance: string,
): string {
  const activeAgents = Object.entries(manifest.swarm_manifest.agents)
    .filter(([, a]) => a.status === "active")
    .map(([id]) => id);
  const currentConnectors = {
    required: manifest.connector_manifest.required.map((e) => e.id),
    suggested: manifest.connector_manifest.suggested.map((e) => e.id),
    deferred: manifest.connector_manifest.deferred.map((e) => e.id),
  };
  const pillarSummary = {
    org_name: manifest.pillar_responses.pillar_1?.org_name,
    industry_hint: manifest.pillar_responses.pillar_1?.industry_hint,
    company_context: manifest.pillar_responses.pillar_1?.company_context?.slice(0, 600),
    ideal_customer_profile: manifest.pillar_responses.pillar_1?.ideal_customer_profile,
    primary_acquisition_channel: manifest.pillar_responses.pillar_1?.primary_acquisition_channel,
    differentiator_hypothesis: manifest.pillar_responses.pillar_1?.differentiator_hypothesis,
    primary_friction_hypothesis: manifest.pillar_responses.pillar_1?.primary_friction_hypothesis,
    product_state: manifest.pillar_responses.pillar_3?.product_state,
    stage: manifest.pillar_responses.pillar_3?.stage,
    gtm_profile_enum: manifest.pillar_responses.pillar_4?.gtm_profile_enum,
    comm_channel: manifest.pillar_responses.pillar_5?.comm_channel,
  };

  return `You are analyzing an operator's refinement guidance against an existing Operator Ω company manifest. The operator wants to refine the imprint and may also imply structural changes to connectors, swarm, or workflows.

Your job is to decide:
1. Is the guidance prose-only (just affects how the imprint reads), or does it imply structural changes the operator would also want?
2. If structural — what specific changes? Each change must be evidence-driven from the operator's guidance + the existing manifest context.

OPERATOR GUIDANCE
"""
${operatorGuidance.trim()}
"""

CURRENT MANIFEST CONTEXT (the operator already has this — propose changes RELATIVE to it)
Pillar summary:
${JSON.stringify(pillarSummary, null, 2)}

Current connectors:
${JSON.stringify(currentConnectors, null, 2)}

Active swarm agents (${activeAgents.length}):
${activeAgents.join(", ")}

MC winner: ${manifest.mc_winner.strategy_id} (sharpe ${manifest.mc_winner.sharpe.toFixed(2)})
Current imprint length: ${manifest.imprint_summary.length} chars

CONNECTOR REGISTRY (use these ids only when proposing connector_add):
${CONNECTOR_REGISTRY_FOR_REFINEMENT.join(", ")}

OUTPUT FORMAT — return ONLY a JSON object with this shape:
{
  "imprint_only": false,        // true when guidance is purely about prose; no changes proposed
  "rationale_summary": "≤300 char summary of the high-level reasoning",
  "changes": [
    // Each change MUST include: id (stable kebab-case), action, rationale (≤200 char), pillar_signal (optional)
    // ACTIONS:
    //   connector_add: { connector_id, bucket: required|suggested|deferred, priority: P-1|P0|P1|P2 }
    //     - Adding to required is HIGH bar — only when connector is genuinely load-bearing for the new direction
    //     - Default to suggested or deferred unless the guidance explicitly demands required
    //   connector_promote: { connector_id, from_bucket: deferred|suggested, to_bucket: suggested|required }
    //     - Connector must already exist in the from_bucket
    //   swarm_overlay: { slot, new_overlay (≤500 chars) }
    //     - Slot must be in the active agents list above
    //     - new_overlay should reference operator-specific context, not generic role copy
    //   workflow_task_add: { slot, task: { task, tier?, flow_type?, connector?, input?, expected_output?, dry_run_gate? } }
    //     - Slot must be in the active agents list above
    //     - dry_run_gate: true for any task that performs writes externally
    //     - tier: T0|T1|T2; flow_type: ASN|TLM|CON|VAL
    //   workflow_escalation_add: { slot, on, to }
    //     - on: trigger condition (e.g. "p_ruin > 0.05"); to: agent slot to escalate to
  ]
}

RULES
- Be conservative. If the guidance is just "use second-person voice" or "drop the topology paragraph", that's imprint_only=true with empty changes.
- Connector_add to required ONLY when the operator's guidance + pillar context make a clear load-bearing case.
- Each change_id must be kebab-case + descriptive (e.g. "add-shipstation-suggested", "overlay-cfo-international").
- Reference specific operator context in rationale ("guidance mentions 160+ country dealer footprint" not "improves the manifest").
- DO NOT propose changes that would violate the required floor (no demotions, no removing matrix-set required entries).
- DO NOT invent agent slots. Use only the slots from "Active swarm agents" above.
- DO NOT invent connector ids. Use only the registry above.
- Maximum 8 changes per refinement call. If guidance implies more, pick the most load-bearing 8.

OUTPUT ONLY JSON. No markdown fences, no commentary.`;
}
