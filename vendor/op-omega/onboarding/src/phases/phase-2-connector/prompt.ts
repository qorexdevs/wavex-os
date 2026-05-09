/**
 * Phase 2 T2 prompt — inference reviews the rule-based baseline and returns
 * a revised manifest as JSON. We prefer JSON over YAML for the T2 response
 * because parsing reliability matters far more than output format.
 */

import type { PillarResponses } from "../../schema/pillar-responses.js";
import type { ConnectorManifest } from "../../schema/connector-manifest.js";

export function buildPhase2Prompt(responses: PillarResponses, baseline: ConnectorManifest): string {
  return `You are generating Phase 2 of Operator Ω onboarding: the connector_manifest.

CONTEXT
Pillar responses (operator's answers):
${JSON.stringify(
  {
    pillar_1: responses.pillar_1,
    pillar_2: { verified: responses.pillar_2?.claude_code_verified, plan: responses.pillar_2?.claude_plan },
    pillar_3: { product_state: responses.pillar_3?.product_state, stage: responses.pillar_3?.stage },
    pillar_4: responses.pillar_4,
    pillar_5: responses.pillar_5,
  },
  null,
  2,
)}

BASELINE (rule-based):
${JSON.stringify(baseline, null, 2)}

CONNECTOR REGISTRY AVAILABLE IN THIS OMEGA INSTANCE (use these ids only — do not invent new ones):
  claude-code, mixpanel, slack, supabase, github, telegram, whatsapp,
  shopify, segment, hubspot, plaid, posthog,
  meta-ads-api, google-ads-api, linkedin-sales-nav

CRITICAL RULES
- DO NOT add Stripe. Financial data flows through Supabase event tables per operator directive.
- DO NOT invent connector ids. If an industry-standard connector isn't in the registry above, either defer it with a clear rationale or drop it silently.
- Every entry must have: id, priority (P-1|P0|P1|P2), rationale (≤120 chars), status (configured|pending_credential|pending_decision).
- dry_run: true on any connector that performs writes; false on notification-only (slack, telegram, whatsapp outbound) since those writes to channels are always gate-kept by the Board.
- blocked_on_manual_approval: include any connector that grants write authority the operator must explicitly confirm.

YOUR JOB
Review the baseline. Return a JSON object with the SAME SHAPE as the baseline. Specifically:
1. Tighten rationales to be specific to the operator's situation (reference their org_name, product_state, gtm_profile).
2. Do not add fields that aren't in the baseline shape.

CONSTRAINTS
- DO NOT move connectors between required / suggested / deferred. The bucket placement is deterministic and authoritative.
- DO NOT change priority values (P-1, P0, P1, P2). Priorities are deterministic and authoritative.
- DO NOT change the connector id list. Do not add or remove connectors.
- ONLY the rationale strings may be rewritten. Status and dry_run flags must be echoed unchanged.

OUTPUT
Return ONLY a JSON object. No markdown, no explanation. Just the JSON.`;
}
