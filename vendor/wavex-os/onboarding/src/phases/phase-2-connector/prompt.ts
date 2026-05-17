/**
 * Phase 2 T2 prompt — inference reviews the rule-based baseline and returns
 * a revised manifest as JSON.
 *
 * Wavex-os relaxation (2026-05): T2 is now allowed to ADD connectors from
 * the broader registry and PROMOTE bucket placement, in addition to
 * tightening rationale text. The deterministic matrix's "required" floor is
 * still authoritative server-side — T2 cannot remove a required entry — but
 * it CAN add new required entries when the operator's enrichment makes a
 * clear case. Same for promoting suggested→required or deferred→suggested.
 */

import type { PillarResponses } from "../../schema/pillar-responses.js";
import type { ConnectorManifest } from "../../schema/connector-manifest.js";

export function buildPhase2Prompt(responses: PillarResponses, baseline: ConnectorManifest): string {
  return `You are generating Phase 2 of Operator Ω onboarding: the connector_manifest.

CONTEXT
Pillar responses (operator's answers, with full T2 enrichment from Pillar 1):
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

BASELINE (rule-based, from the deterministic decision matrix):
${JSON.stringify(baseline, null, 2)}

CONNECTOR REGISTRY (use these ids only — do not invent new ones):
  Inference + comms: claude-code, slack, telegram, whatsapp, twilio-sms, sendgrid
  Data substrate:   supabase, segment, posthog, mixpanel, amplitude
  Engineering:      github
  Ads + acquisition: meta-ads-api, google-ads-api, linkedin-sales-nav
  Commerce:         stripe, stripe-connect, shopify, bigcommerce, shipstation, klaviyo
  CRM + sales:      hubspot, salesforce, intercom, zendesk, calendly
  Productivity:     notion, airtable, linear, google_calendar, google_drive, gmail
  Vertical:         plaid, docusign, clio
  AI infra:         openai, anthropic

YOUR JOB
Review the baseline and return a JSON object with the SAME SHAPE as the baseline. You may:
1. TIGHTEN rationales to be specific to the operator's situation. Reference their org_name,
   pillar_1.company_context, ideal_customer_profile, primary_acquisition_channel,
   product_maturity_signal, primary_friction_hypothesis — i.e. the rich enrichment from
   Pillar 1, not just the categorical hints.
2. ADD new connectors from the registry above when the enrichment makes an evidence-driven
   case. E.g. if company_context mentions "Stripe billing" or "Klaviyo email" or "we use
   HubSpot for the sales motion" — add those connectors with a rationale that quotes the
   evidence. Place added connectors in suggested or deferred (NOT required) — bucket
   promotion to required is gated.
3. PROMOTE existing connectors between buckets ONLY when the operator's enrichment provides
   a clear, evidence-driven justification (not a hunch). Allowed promotions:
     - deferred → suggested
     - suggested → required (rare, only when the connector is genuinely load-bearing for the
       company's specific motion)
   Demotions (required → suggested, suggested → deferred) are NOT allowed — the matrix's
   required floor is authoritative.

STRUCTURAL RULES
- Every entry must have: id, priority (P-1|P0|P1|P2), rationale (≤180 chars), status
  (configured|pending_credential|pending_decision).
- dry_run: true on any connector that performs writes; false on notification-only outbound
  (slack, telegram, whatsapp) since those writes are gate-kept by the Board.
- blocked_on_manual_approval: include any connector that grants write authority requiring
  explicit operator confirmation (e.g. shopify writes, stripe-connect payouts).
- Echo every existing baseline entry — do not silently drop matrix-set connectors. If you
  think a baseline entry shouldn't apply, leave it AND add a rationale explaining why; the
  operator decides whether to skip it via the Concierge.

OUTPUT
Return ONLY a JSON object. No markdown, no explanation. Just the JSON.`;
}
