/** Template affinities — per-template tags that drive matrix selection.
 *
 *  The deterministic scorer matches a slot's signal context (industry,
 *  stage, GTM motion, required connectors) against each candidate
 *  template's tags here, picks the highest-scoring template per slot,
 *  and writes it to the manifest with a rationale.
 *
 *  Schema (per template):
 *    industries:  what business shapes this role excels at
 *    stages:      what company stages this role earns its keep at
 *    gtm:         what go-to-market motions this role complements
 *    connectors:  connector ids whose presence boosts this template
 *
 *  An empty array on any axis means "neutral / no preference" — neither
 *  boost nor penalty. Tags are presence/absence (not weighted), so the
 *  scorer counts overlapping tags and normalizes per axis.
 *
 *  When no candidate has any matching tags for a slot, the scorer falls
 *  back to SLOT_TO_TEMPLATE (catalog default) so the bridge always has a
 *  picked template. */

export interface TemplateAffinities {
  industries: string[];
  stages: string[];
  gtm: string[];
  connectors: string[];
}

/** Industries — derived from pillar_1 enrichment industry_canonical hint
 *  + manual_context keyword sniffing. Keep tags lowercase, hyphenated. */
export type Industry =
  | "saas-b2b" | "saas-b2c" | "marketplace" | "ecommerce-dtc"
  | "fintech" | "healthtech" | "edtech" | "hardware" | "agency-services"
  | "open-source" | "regulated";

/** Pillar 3 stage — direct from upstream enum. */
export type Stage =
  | "pre_product" | "0_10k_arr" | "10k_100k_mrr" | "100k_500k_arr"
  | "500k_1m_arr" | "1m_5m_arr" | "5m_10m_arr" | "10m_plus_arr";

/** GTM bucket — derived from pillar_4 sales_motion + lead_sources. */
export type Gtm =
  | "self-serve" | "assisted-demo" | "high-touch-enterprise"
  | "paid-led" | "referral-led" | "community-led" | "none-yet";

const empty: TemplateAffinities = { industries: [], stages: [], gtm: [], connectors: [] };

/** Affinities for templates we've authored explicitly. Anything not in this
 *  map gets `empty` (neutral) — still a candidate, just no positive signal.
 *
 *  Coverage strategy: high-variation slots first (cpo.qa, cdo.signal, cmo.brand,
 *  cmo.demand, cro.outbound, cro.demo, coo.health, coo.observability). Specialty
 *  templates from the broader catalog get tagged when they're plausible
 *  candidates for one of these slots. */

export const AFFINITIES: Record<string, TemplateAffinities> = {
  // ── cpo.qa candidates ─────────────────────────────────────────────────
  "accessibility-auditor": {
    industries: ["saas-b2b", "saas-b2c", "marketplace", "ecommerce-dtc", "edtech"],
    stages: ["10k_100k_mrr", "100k_500k_arr", "500k_1m_arr", "1m_5m_arr"],
    gtm: ["assisted-demo", "self-serve", "high-touch-enterprise"],
    connectors: [],
  },
  "performance-benchmarker": {
    industries: ["ecommerce-dtc", "saas-b2c", "marketplace"],
    stages: ["10k_100k_mrr", "100k_500k_arr", "1m_5m_arr"],
    gtm: ["paid-led", "self-serve"],
    connectors: ["shopify", "stripe", "klaviyo"],
  },
  "api-tester": {
    industries: ["saas-b2b", "fintech", "open-source", "marketplace"],
    stages: ["10k_100k_mrr", "100k_500k_arr", "1m_5m_arr", "5m_10m_arr"],
    gtm: ["self-serve", "assisted-demo"],
    connectors: ["github", "stripe-connect", "plaid", "stripe"],
  },
  "test-writer-fixer": {
    industries: ["saas-b2b", "open-source", "marketplace"],
    stages: ["10k_100k_mrr", "100k_500k_arr", "1m_5m_arr", "5m_10m_arr"],
    gtm: ["self-serve", "assisted-demo", "community-led"],
    connectors: ["github"],
  },
  "workflow-optimizer": {
    industries: ["saas-b2b", "agency-services", "fintech"],
    stages: ["100k_500k_arr", "500k_1m_arr", "1m_5m_arr"],
    gtm: ["high-touch-enterprise", "assisted-demo"],
    connectors: [],
  },

  // ── cdo.signal candidates ─────────────────────────────────────────────
  "ai-engineer": {
    industries: ["saas-b2b", "saas-b2c", "marketplace", "open-source", "edtech"],
    stages: ["10k_100k_mrr", "100k_500k_arr", "1m_5m_arr", "5m_10m_arr"],
    gtm: ["self-serve", "assisted-demo", "community-led"],
    connectors: [],
  },
  "prompt-engineer": {
    industries: ["healthtech", "fintech", "regulated", "edtech"],
    stages: ["100k_500k_arr", "500k_1m_arr", "1m_5m_arr"],
    gtm: ["high-touch-enterprise", "assisted-demo"],
    connectors: [],
  },
  "mlops-engineer": {
    industries: ["saas-b2b", "marketplace", "fintech"],
    stages: ["1m_5m_arr", "5m_10m_arr", "10m_plus_arr"],
    gtm: ["assisted-demo", "high-touch-enterprise"],
    connectors: [],
  },
  "reality-checker": {
    industries: ["fintech", "healthtech", "regulated"],
    stages: ["500k_1m_arr", "1m_5m_arr", "5m_10m_arr", "10m_plus_arr"],
    gtm: ["high-touch-enterprise"],
    connectors: ["stripe-connect", "plaid", "stripe"],
  },
  "data-engineer": {
    industries: ["ecommerce-dtc", "marketplace", "saas-b2b"],
    stages: ["100k_500k_arr", "1m_5m_arr", "5m_10m_arr"],
    gtm: ["paid-led", "self-serve"],
    connectors: ["meta-ads-api", "google-ads-api", "segment", "klaviyo"],
  },

  // ── cmo.brand candidates ──────────────────────────────────────────────
  "ad-creative-strategist": {
    industries: ["ecommerce-dtc", "saas-b2c", "marketplace"],
    stages: ["100k_500k_arr", "1m_5m_arr", "5m_10m_arr"],
    gtm: ["paid-led", "self-serve"],
    connectors: ["meta-ads-api", "google-ads-api", "klaviyo"],
  },
  "brand-guardian": {
    industries: ["agency-services", "saas-b2b", "ecommerce-dtc"],
    stages: ["1m_5m_arr", "5m_10m_arr", "10m_plus_arr"],
    gtm: ["high-touch-enterprise", "referral-led"],
    connectors: [],
  },
  "story-architect": {
    industries: ["saas-b2b", "agency-services", "edtech"],
    stages: ["100k_500k_arr", "500k_1m_arr", "1m_5m_arr"],
    gtm: ["high-touch-enterprise", "referral-led"],
    connectors: [],
  },
  "content-creator": {
    industries: ["saas-b2b", "ecommerce-dtc", "open-source", "edtech"],
    stages: ["10k_100k_mrr", "100k_500k_arr", "500k_1m_arr"],
    gtm: ["community-led", "self-serve", "referral-led"],
    connectors: [],
  },

  // ── cmo.demand candidates ─────────────────────────────────────────────
  "growth-hacker": {
    industries: ["saas-b2b", "saas-b2c", "marketplace", "ecommerce-dtc"],
    stages: ["10k_100k_mrr", "100k_500k_arr", "1m_5m_arr"],
    gtm: ["self-serve", "paid-led", "assisted-demo"],
    connectors: ["mixpanel", "posthog", "segment"],
  },
  "ppc-strategist": {
    industries: ["ecommerce-dtc", "saas-b2c", "marketplace"],
    stages: ["100k_500k_arr", "1m_5m_arr", "5m_10m_arr"],
    gtm: ["paid-led"],
    connectors: ["meta-ads-api", "google-ads-api", "klaviyo"],
  },
  "seo-specialist": {
    industries: ["saas-b2b", "ecommerce-dtc", "open-source", "edtech"],
    stages: ["100k_500k_arr", "500k_1m_arr", "1m_5m_arr"],
    gtm: ["self-serve", "community-led"],
    connectors: [],
  },
  "community-builder": {
    industries: ["open-source", "saas-b2b", "edtech"],
    stages: ["10k_100k_mrr", "100k_500k_arr", "500k_1m_arr"],
    gtm: ["community-led", "self-serve"],
    connectors: ["discord", "slack", "github"],
  },

  // ── cro.outbound candidates ───────────────────────────────────────────
  "sales-coach": {
    industries: ["saas-b2b", "fintech", "agency-services"],
    stages: ["100k_500k_arr", "500k_1m_arr", "1m_5m_arr", "5m_10m_arr"],
    gtm: ["assisted-demo", "high-touch-enterprise"],
    connectors: ["hubspot", "salesforce", "linkedin-sales-nav"],
  },
  "outbound-prospector": {
    industries: ["saas-b2b", "fintech", "healthtech", "agency-services"],
    stages: ["100k_500k_arr", "500k_1m_arr", "1m_5m_arr"],
    gtm: ["assisted-demo", "high-touch-enterprise"],
    connectors: ["linkedin-sales-nav", "hubspot", "salesforce"],
  },

  // ── cro.demo candidates ───────────────────────────────────────────────
  "sales-engineer": {
    industries: ["saas-b2b", "fintech", "healthtech"],
    stages: ["500k_1m_arr", "1m_5m_arr", "5m_10m_arr", "10m_plus_arr"],
    gtm: ["assisted-demo", "high-touch-enterprise"],
    connectors: ["github", "salesforce"],
  },
  "solutions-architect": {
    industries: ["saas-b2b", "fintech", "healthtech", "regulated"],
    stages: ["1m_5m_arr", "5m_10m_arr", "10m_plus_arr"],
    gtm: ["high-touch-enterprise"],
    connectors: ["salesforce", "docusign", "stripe-connect"],
  },

  // ── coo.health candidates ─────────────────────────────────────────────
  "recovery-engineer": {
    industries: ["saas-b2b", "marketplace", "open-source"],
    stages: ["100k_500k_arr", "500k_1m_arr", "1m_5m_arr"],
    gtm: ["self-serve", "assisted-demo", "community-led"],
    connectors: [],
  },
  "incident-responder": {
    industries: ["fintech", "healthtech", "regulated", "marketplace"],
    stages: ["1m_5m_arr", "5m_10m_arr", "10m_plus_arr"],
    gtm: ["high-touch-enterprise", "assisted-demo"],
    connectors: ["pagerduty", "datadog", "slack"],
  },
  "infrastructure-maintainer": {
    industries: ["saas-b2b", "open-source", "marketplace"],
    stages: ["1m_5m_arr", "5m_10m_arr", "10m_plus_arr"],
    gtm: ["self-serve", "community-led"],
    connectors: [],
  },

  // ── coo.observability candidates ─────────────────────────────────────
  "devops-engineer": {
    industries: ["saas-b2b", "open-source", "marketplace"],
    stages: ["10k_100k_mrr", "100k_500k_arr", "500k_1m_arr", "1m_5m_arr"],
    gtm: ["self-serve", "assisted-demo"],
    connectors: ["github"],
  },
  "performance-benchmarker_obs": empty, // intentional: signal that perf-bench can serve obs in some contexts
  "analytics-reporter": {
    industries: ["ecommerce-dtc", "saas-b2c", "marketplace", "edtech"],
    stages: ["100k_500k_arr", "1m_5m_arr"],
    gtm: ["self-serve", "paid-led"],
    connectors: ["mixpanel", "posthog", "segment", "google-ads-api"],
  },

  // ── cdo.attribute candidates ─────────────────────────────────────────
  "support-analytics": {
    industries: ["saas-b2b", "saas-b2c", "marketplace", "edtech"],
    stages: ["100k_500k_arr", "500k_1m_arr", "1m_5m_arr"],
    gtm: ["self-serve", "assisted-demo"],
    connectors: ["mixpanel", "posthog"],
  },
  "growth-experiment-designer": {
    industries: ["ecommerce-dtc", "saas-b2c", "marketplace"],
    stages: ["100k_500k_arr", "1m_5m_arr"],
    gtm: ["paid-led", "self-serve"],
    connectors: ["meta-ads-api", "google-ads-api", "mixpanel"],
  },

  // C-suite slots (cmo, cro, etc.) stay on the wavex-authored 1:1 templates.
  // They're functional roles, not compositional ones, so no per-company
  // variation makes sense.
  ceo: empty,
  cmo: empty, cro: empty, cfo: empty, cdo: empty, coo: empty, cpo: empty,
};

// Auto-derived affinities for the 146 templates without explicit hand-tagged
// entries. Generated by scripts/generate-affinities.mjs from registry +
// templateId keyword heuristics. Hand-authored AFFINITIES wins on conflict.
import { AUTO_AFFINITIES } from "./affinities-auto.js";

export function affinitiesFor(templateId: string): TemplateAffinities {
  return AFFINITIES[templateId] ?? AUTO_AFFINITIES[templateId] ?? empty;
}
