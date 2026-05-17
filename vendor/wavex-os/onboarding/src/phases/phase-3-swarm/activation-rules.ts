/**
 * Bottom-up swarm activation rules (F3 · WaveX audit fix).
 *
 * Every agent starts parked. Each has a rule that maps
 * `{pillar_responses, connectors}` to an `ActivationVerdict`:
 *   - `active` — positive signal justifies the cost
 *   - `parked` — not needed yet, with a clear unpark condition
 *   - `disabled` — structurally irrelevant for this operator's situation
 *
 * This replaces the prior subtractive logic where every agent was `active`
 * by default and the decision matrix only removed via negative signals.
 */

import type { PillarResponses } from "../../schema/pillar-responses.js";

export type ActivationVerdict =
  | { status: "active"; skill_overlay?: string }
  | { status: "standby"; waiting_on_connector: string; skill_overlay?: string }
  | { status: "parked"; unpark_condition: string; skill_overlay?: string }
  | { status: "disabled"; reason: string };

export interface ActivationContext {
  responses: PillarResponses;
  connectors: Set<string>;
  /**
   * Credential-vault state per credential_key (Credential Concierge integration).
   * When present, callers can post-process verdicts via `applyCredentialStateToVerdict`
   * to flip `active`/`standby` to `parked` when the credential a connector depends on
   * is `skipped` or `invalid`. Existing rules don't read this directly — backwards-compatible.
   */
  credentialStatus?: Record<string, "valid" | "skipped" | "invalid" | "unvalidated">;
}

/**
 * Map from connector slug to the credential_key that powers it. Used by
 * `applyCredentialStateToVerdict` to know which credential gates which connector.
 * Composio-handled connectors (oauth) are not in this map — they have no
 * direct credential. claude-code is verified by Pillar 2.
 */
export const CONNECTOR_TO_GATING_CREDENTIAL: Record<string, string> = {
  supabase: "supabase_service_role_key",
  github: "github_pat",
  mixpanel: "mixpanel_project_token",
};

/**
 * Post-process a verdict to flip to `parked` when the connector this verdict
 * depended on has a `skipped` or `invalid` credential. Use the connector slug
 * the rule cared about (e.g. `cdo.signal` cares about `supabase` or `mixpanel`).
 *
 * Existing rules are pure — this is a layer on top. Callers that don't pass
 * `credentialStatus` get unchanged behavior.
 */
export function applyCredentialStateToVerdict(
  verdict: ActivationVerdict,
  ctx: ActivationContext,
  gatingConnectorSlug: string,
): ActivationVerdict {
  if (!ctx.credentialStatus) return verdict;
  const credentialKey = CONNECTOR_TO_GATING_CREDENTIAL[gatingConnectorSlug];
  if (!credentialKey) return verdict;
  const status = ctx.credentialStatus[credentialKey];
  if (status === "skipped" || status === "invalid") {
    return {
      status: "parked",
      unpark_condition: `Provide a valid ${credentialKey} via /connectors to activate (currently ${status}).`,
    };
  }
  return verdict;
}

/**
 * Agents in CORE are always active regardless of pillar signals — they're the
 * minimum viable swarm: the operator's CEO + the six department chiefs.
 * Anything outside this set must earn activation via a positive signal.
 */
// @tunable phase3.core_agents
export const CORE_AGENTS: readonly string[] = [
  "ceo.orchestrator",
  "cpo",
  "cmo",
  "cro",
  "cfo",
  "cdo",
  "coo",
] as const;

/* --- Signal helpers --- */

function hasProduct(ctx: ActivationContext): boolean {
  return ctx.responses.pillar_1?.has_product === true;
}

function livePaying(ctx: ActivationContext): boolean {
  return ctx.responses.pillar_3?.product_state === "live_paying_customers";
}

function preRevenue(ctx: ActivationContext): boolean {
  const ps = ctx.responses.pillar_3?.product_state;
  return ps === "idea_only" || ps === "built_not_selling" || ps === "prototype_mvp";
}

/** Stage ordering (lower index = earlier). Stages not in this table are treated as mid-range. */
// @tunable phase3.stage_order
const STAGE_ORDER: Record<string, number> = {
  pre_product: 0,
  pre_launch: 0,
  soft_launched: 1,
  less_than_10k_mrr: 1,
  "10k_100k_mrr": 2,
  "100k_1m_mrr": 3,
  more_than_1m_mrr: 4,
};

function stageAtLeast(ctx: ActivationContext, min: number): boolean {
  const stage = ctx.responses.pillar_3?.stage ?? "";
  const n = STAGE_ORDER[stage] ?? 2;
  return n >= min;
}

function gtmIn(ctx: ActivationContext, profiles: string[]): boolean {
  const gtm = ctx.responses.pillar_4?.gtm_profile_enum ?? "";
  return profiles.includes(gtm);
}

function salesMotionAssisted(ctx: ActivationContext): boolean {
  const sm = ctx.responses.pillar_4?.sales_motion ?? "";
  return sm === "assisted_demo" || sm === "high_touch_enterprise";
}

function leadSourceIs(ctx: ActivationContext, sources: string[]): boolean {
  // Multi-select aware: any match across the selected lead_sources activates.
  const selected = ctx.responses.pillar_4?.lead_sources
    ?? (ctx.responses.pillar_4?.lead_source ? [ctx.responses.pillar_4.lead_source] : []);
  return selected.some((s) => sources.includes(s));
}

function hasConnector(ctx: ActivationContext, id: string): boolean {
  return ctx.connectors.has(id);
}

function hasAnyConnector(ctx: ActivationContext, ids: string[]): boolean {
  return ids.some((id) => ctx.connectors.has(id));
}

function industryIs(ctx: ActivationContext, industries: string[]): boolean {
  const hint = ctx.responses.pillar_1?.industry_hint ?? "";
  return industries.includes(hint);
}

function isRegulatedIndustry(ctx: ActivationContext): boolean {
  return industryIs(ctx, ["fintech", "fintech_retail", "healthtech", "legal_tech"]);
}

/* --- Activation rules (agent id → verdict) --- */

type Rule = (ctx: ActivationContext) => ActivationVerdict;

const alwaysActive: Rule = () => ({ status: "active" });

export const ACTIVATION_RULES: Record<string, Rule> = {
  // --- Product ---
  "cpo.build": (ctx) => {
    if (!hasProduct(ctx)) return { status: "parked", unpark_condition: "Operator ships their first product (has_product=true)" };
    if (!hasConnector(ctx, "github")) return { status: "standby", waiting_on_connector: "github" };
    // Dev-tools industry: elevate build focus with an overlay signal.
    if (industryIs(ctx, ["dev_tools", "dev_infrastructure"])) {
      return { status: "active", skill_overlay: "dev_tools_industry: code velocity IS the product — build cadence gates activation" };
    }
    return { status: "active" };
  },
  "cpo.qa": (ctx) => {
    if (!hasProduct(ctx)) return { status: "disabled", reason: "No product to QA yet" };
    if (!livePaying(ctx)) return { status: "parked", unpark_condition: "First paying customer (product_state=live_paying_customers)" };
    return { status: "active" };
  },
  "cpo.roadmap": alwaysActive,  // Roadmap matters at every stage — what to build next is always a question
  "cpo.growth": (ctx) => {
    if (preRevenue(ctx)) return { status: "parked", unpark_condition: "Product is live with users to activate" };
    // Consumer mobile + DTC: activation loop is the primary lever.
    if (industryIs(ctx, ["consumer_mobile", "dtc_ecommerce", "consumer_ai"])) {
      return { status: "active", skill_overlay: "consumer_activation_primary: activation funnel is load-bearing at this scale" };
    }
    return { status: "active" };
  },

  // --- Marketing ---
  "cmo.demand": (ctx) => {
    if (gtmIn(ctx, ["BOOTSTRAP_NO_GTM"])) return { status: "parked", unpark_condition: "Operator adopts a GTM motion (pillar_4.lead_source != none_yet)" };
    // DTC ecommerce: always active — ad-bidding + demand gen is the operating cadence.
    if (industryIs(ctx, ["dtc_ecommerce"])) {
      return { status: "active", skill_overlay: "dtc_ecom_daily_bidding: bid optimization runs hourly; performance is the product" };
    }
    if (leadSourceIs(ctx, ["inbound_ads_meta_google", "content_seo"])) return { status: "active" };
    return { status: "parked", unpark_condition: "Inbound lead source becomes primary" };
  },
  "cmo.content": (ctx) => {
    if (gtmIn(ctx, ["CONTENT_LED_PLG", "INBOUND_PLG", "INBOUND_MID_TOUCH"])) return { status: "active" };
    if (leadSourceIs(ctx, ["content_seo"])) return { status: "active" };
    return { status: "parked", unpark_condition: "Content-led or inbound motion adopted" };
  },
  "cmo.brand": (ctx) => {
    if (preRevenue(ctx)) return { status: "active", skill_overlay: "activate_early: narrative-first while waiting for PMF" };
    if (stageAtLeast(ctx, 3)) return { status: "active" };
    return { status: "parked", unpark_condition: "Stage reaches 100k_1m_mrr (positioning becomes load-bearing)" };
  },
  "cmo.advocacy": (ctx) => {
    if (stageAtLeast(ctx, 3)) return { status: "active" };
    if (gtmIn(ctx, ["REFERRAL_LED"])) return { status: "active" };
    // Open-source devtools: community advocacy IS the growth motion.
    if (industryIs(ctx, ["dev_tools"]) && hasConnector(ctx, "github")) {
      return { status: "active", skill_overlay: "open_core_community: GitHub stars + contributor growth are your advocacy KPIs" };
    }
    return { status: "parked", unpark_condition: "Stage reaches 100k_1m_mrr or referral motion adopted" };
  },

  // --- Revenue ---
  "cro.outbound": (ctx) => {
    if (gtmIn(ctx, ["OUTBOUND_HIGH_TOUCH_SAAS", "OUTBOUND_MID_MARKET"])) return { status: "active" };
    return { status: "parked", unpark_condition: "Outbound sales motion adopted (gtm_profile_enum starts with OUTBOUND_)" };
  },
  "cro.demo": (ctx) => {
    if (salesMotionAssisted(ctx)) return { status: "active" };
    return { status: "parked", unpark_condition: "Sales motion becomes assisted_demo or high_touch_enterprise" };
  },
  "cro.close": (ctx) => {
    if (salesMotionAssisted(ctx)) return { status: "active" };
    return { status: "parked", unpark_condition: "Sales motion becomes assisted_demo or high_touch_enterprise" };
  },
  "cro.expansion": (ctx) => {
    if (!livePaying(ctx)) return { status: "parked", unpark_condition: "First paying customers present (product_state=live_paying_customers)" };
    if (!stageAtLeast(ctx, 2)) return { status: "parked", unpark_condition: "Stage reaches 10k_100k_mrr (enough accounts to expand)" };
    // Enterprise SaaS: expansion is the primary revenue engine. Mark spawnable intent via overlay.
    if (industryIs(ctx, ["enterprise_saas"])) {
      return { status: "active", skill_overlay: "enterprise_account_mining: expansion MRR > new-logo MRR; CSM signals drive spawn cadence" };
    }
    return { status: "active" };
  },

  // --- Finance ---
  "cfo.capital": alwaysActive,  // Budget enforcement applies at every stage
  "cfo.forecast": (ctx) => {
    if (!stageAtLeast(ctx, 2)) return { status: "parked", unpark_condition: "Stage reaches 10k_100k_mrr (forecast becomes actionable)" };
    if (!hasConnector(ctx, "supabase")) return { status: "standby", waiting_on_connector: "supabase" };
    return { status: "active" };
  },
  "cfo.treasury": (ctx) => {
    if (!livePaying(ctx)) return { status: "parked", unpark_condition: "First paying customer (product_state=live_paying_customers)" };
    if (!hasConnector(ctx, "supabase")) return { status: "standby", waiting_on_connector: "supabase" };
    return { status: "active" };
  },
  "cfo.econ": (ctx) => {
    if (preRevenue(ctx)) return { status: "disabled", reason: "Pre-revenue — no LTV/CAC ratio to defend yet" };
    // Regulated industries: compliance narrative is the real "econ" lens — activate early.
    if (isRegulatedIndustry(ctx) && livePaying(ctx)) {
      return { status: "active", skill_overlay: "regulated_compliance: LTV/CAC reporting must withstand regulator audit; structured event trail via supabase" };
    }
    if (!stageAtLeast(ctx, 2)) return { status: "parked", unpark_condition: "Stage reaches 10k_100k_mrr (unit economics become the primary lens)" };
    return { status: "active" };
  },

  // --- Data ---
  "cdo.signal": (ctx) => {
    if (hasAnyConnector(ctx, ["mixpanel", "supabase"])) return { status: "active" };
    return { status: "standby", waiting_on_connector: "mixpanel or supabase" };
  },
  "cdo.attribute": (ctx) => {
    if (!livePaying(ctx)) return { status: "parked", unpark_condition: "Paying customers present (so there is something to attribute)" };
    if (!hasAnyConnector(ctx, ["mixpanel", "supabase"])) return { status: "standby", waiting_on_connector: "mixpanel or supabase" };
    return { status: "active" };
  },
  "cdo.telemetry": (ctx) => {
    if (hasAnyConnector(ctx, ["mixpanel", "supabase"])) return { status: "active" };
    return { status: "standby", waiting_on_connector: "mixpanel or supabase" };
  },
  "cdo.infer": alwaysActive,  // Monte Carlo + inference infrastructure runs at every stage

  // --- Ops (core infrastructure — a subset is always-active; the rest earn it) ---
  "coo.health": alwaysActive,         // System heartbeat — non-negotiable
  "coo.scheduler": alwaysActive,      // Without it, nothing fires
  "coo.observability": alwaysActive,  // Visibility into agent behavior
  "coo.connector": (ctx) => ctx.connectors.size >= 2 ? { status: "active" } : { status: "parked", unpark_condition: "Multiple connectors configured" },
  "coo.memory": (ctx) => hasProduct(ctx) ? { status: "active" } : { status: "parked", unpark_condition: "Operator ships a product (something to remember about)" },
  "coo.dashboard": (ctx) => stageAtLeast(ctx, 2) ? { status: "active" } : { status: "parked", unpark_condition: "Stage reaches 10k_100k_mrr (dashboard becomes load-bearing for Board communication)" },
  "coo.credentials": alwaysActive, // Credential custodian — every Swarm needs credential custody. Ships dormant; rotation logic feature-flagged.
};

/** Look up an agent's verdict for this context. Agents in CORE_AGENTS always return active. */
export function evaluateAgent(agentId: string, ctx: ActivationContext): ActivationVerdict {
  if (CORE_AGENTS.includes(agentId)) return { status: "active" };
  const rule = ACTIVATION_RULES[agentId];
  if (!rule) return { status: "parked", unpark_condition: "No activation rule defined — agent is not expected at this stage" };
  return rule(ctx);
}
