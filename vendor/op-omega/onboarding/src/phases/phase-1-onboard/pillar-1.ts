/**
 * Pillar 1 — Organization Identity.
 *
 * Single input: a URL, a GitHub repo, or the string "no product yet". We
 * enrich via one T2 call (tier-router) to extract company_context + hints.
 * If enrichment fails or input is "no product yet", fall back to a
 * pre-product branch.
 */

import { route } from "@op-omega/plugin-tier-router";
import type { Pillar1Response } from "../../schema/pillar-responses.js";
import { OnboardingHaltError } from "../../errors.js";

export interface Pillar1Input {
  org_name: string;
  raw_input: string;
  /** Optional companyId so tier-router can consult rate-limit-budget. */
  companyId?: string;
  /** Override — primarily for tests that want to skip the live T2 call. */
  deterministicOverride?: Omit<Pillar1Response, "enriched_at">;
  /** Operator-supplied product description, used when URL enrichment fails
   *  and the UI routes through a manual-capture prompt. When provided, skips
   *  the T2 enrichment call entirely and marks enrichment_status="manual_capture". */
  manual_context?: string;
}

/**
 * A company_context is "meaningful" only if T2 explicitly signaled it couldn't
 * fetch the URL (the deep-dive prompt instructs it to start with
 * "Could not fetch:" in that case) OR the result is empty/extremely short.
 *
 * Wavex-os relaxation (2026-05): we DROPPED the keyword regex and the 40-char
 * floor was raised to 30 — real URLs always produce rich enrichment with the
 * deep-dive prompt; the only legitimate halt path is genuine fetch failure.
 * Per upstream-vs-local protocol alignment, F1 fail-closed only fires on
 * unambiguous T2-side failure markers, not on stylistically terse outputs.
 */
export function isEnrichmentMeaningful(context: string | null | undefined): boolean {
  if (!context) return false;
  const trimmed = context.trim();
  if (trimmed.length < 30) return false;
  // T2 fetch-failure markers — the deep-dive prompt instructs it to lead with
  // "Could not fetch:" when it genuinely couldn't read the URL.
  if (/^(could not fetch|cannot fetch|unable to fetch|failed to fetch)/i.test(trimmed)) return false;
  // Pure-placeholder responses (rare with the deep-dive prompt, but kept as
  // a safety net for misbehaving model output).
  if (/^(unspecified|unknown|pre.?product|no.?info)$/i.test(trimmed)) return false;
  return true;
}

const NO_PRODUCT_MARKERS = ["no product", "pre-product", "pre product", "not yet", "none"];

export function looksLikeNoProduct(raw: string): boolean {
  const r = raw.trim().toLowerCase();
  return NO_PRODUCT_MARKERS.some((m) => r.includes(m));
}

function guessIndustryHint(context: string): string {
  const lower = context.toLowerCase();
  if (lower.includes("b2b") || lower.includes("saas") || lower.includes("enterprise")) return "b2b_saas";
  if (lower.includes("b2c") || lower.includes("consumer")) return "b2c";
  if (lower.includes("developer") || lower.includes("api") || lower.includes("sdk")) return "dev_tools";
  if (lower.includes("marketplace")) return "marketplace";
  if (lower.includes("e-commerce") || lower.includes("ecommerce")) return "ecommerce";
  return "unknown";
}

function guessBusinessModelHint(context: string): string {
  const lower = context.toLowerCase();
  if (lower.includes("subscription") || lower.includes("monthly") || lower.includes("mrr")) return "subscription";
  if (lower.includes("usage") || lower.includes("metered")) return "usage_based";
  if (lower.includes("one-time") || lower.includes("perpetual")) return "one_time";
  if (lower.includes("marketplace") || lower.includes("take rate") || lower.includes("commission")) return "marketplace";
  return "subscription"; // most common default
}

/**
 * Heuristic ICP extraction from company_context. Used when T2 didn't return a
 * structured icp field. Keep it terse (≤60 chars) so downstream prompts can
 * reference it directly.
 */
function guessIdealCustomerProfile(context: string): string {
  const lower = context.toLowerCase();
  if (lower.includes("enterprise")) return "enterprise ops teams";
  if (lower.includes("mid-market") || lower.includes("midmarket")) return "mid-market ops teams";
  if (lower.includes("fortune") || lower.includes("f500")) return "Fortune-500 enterprises";
  if (lower.includes("founder") || lower.includes("startup")) return "early-stage founders";
  if (lower.includes("developer") || lower.includes("devops")) return "developers and platform teams";
  if (lower.includes("law firm") || lower.includes("attorney")) return "solo + boutique law firms";
  if (lower.includes("clinic") || lower.includes("hipaa")) return "outpatient clinics";
  if (lower.includes("bank") || lower.includes("credit union")) return "regional banks + credit unions";
  if (lower.includes("ecom") || lower.includes("dtc") || lower.includes("shopify")) return "DTC ecommerce brands";
  if (lower.includes("marketplace")) return "two-sided marketplace participants";
  if (lower.includes("b2b")) return "b2b buyers";
  if (lower.includes("consumer") || lower.includes("b2c")) return "consumers";
  return "unspecified";
}

function guessRevenueModel(context: string, hint: string): string {
  const lower = context.toLowerCase();
  if (hint === "marketplace" || lower.includes("take rate") || lower.includes("commission")) return "take-rate marketplace";
  if (hint === "usage_based" || lower.includes("usage") || lower.includes("metered")) return "usage-based";
  if (hint === "one_time" || lower.includes("one-time")) return "one-time + repeat";
  if (lower.includes("per seat") || lower.includes("seat-based") || lower.includes("per-seat")) return "subscription seat";
  if (lower.includes("open source") || lower.includes("open-core")) return "open-core subscription";
  if (lower.includes("subscription") || lower.includes("monthly")) return "subscription";
  return hint;
}

function guessCompetitivePosition(context: string): string {
  const lower = context.toLowerCase();
  if (lower.includes("category leader") || lower.includes("market leader")) return "category leader";
  if (lower.includes("vertical") || lower.includes("industry-specific")) return "vertical specialist";
  if (lower.includes("niche")) return "niche";
  if (lower.includes("prototype") || lower.includes("mvp") || lower.includes("beta")) return "unvalidated";
  if (lower.includes("waitlist") || lower.includes("pre-launch")) return "emerging";
  if (lower.includes("productizing") || lower.includes("pivot")) return "emerging";
  return "emerging";
}

function guessPrimaryAcquisitionChannel(context: string): string {
  const lower = context.toLowerCase();
  if (lower.includes("seo") || lower.includes("content")) return "content seo";
  if (lower.includes("paid ads") || lower.includes("meta ads") || lower.includes("google ads")) return "paid ads";
  if (lower.includes("outbound") || lower.includes("cold outreach")) return "outbound sales";
  if (lower.includes("referral") || lower.includes("word of mouth")) return "referral";
  if (lower.includes("partner")) return "partnerships";
  if (lower.includes("waitlist")) return "waitlist";
  if (lower.includes("community") || lower.includes("open source")) return "community-led";
  if (lower.includes("tiktok") || lower.includes("creator") || lower.includes("influencer")) return "creator-led";
  return "unspecified";
}

/**
 * Sprint 002 · Issue 5 · additional heuristic fallbacks for the new
 * differentiation signals (product_maturity, tone, friction, differentiator).
 */

type ProductMaturity = "pre_mvp" | "mvp" | "ga" | "mature" | "legacy";

function guessProductMaturity(context: string): ProductMaturity {
  const lower = context.toLowerCase();
  if (lower.includes("idea") || lower.includes("pre-product")) return "pre_mvp";
  if (lower.includes("prototype") || lower.includes("mvp") || lower.includes("private beta")) return "mvp";
  if (lower.includes("ga") || lower.includes("general availability") || lower.includes("launched")) return "ga";
  if (lower.includes("years in market") || lower.includes("established")) return "mature";
  if (lower.includes("legacy")) return "legacy";
  return "ga"; // safe default: operator has something shipped
}

type ToneSignal = "technical" | "friendly" | "authoritative" | "playful" | "enterprise";

function guessTone(context: string): ToneSignal {
  const lower = context.toLowerCase();
  if (lower.includes("enterprise") || lower.includes("fortune") || lower.includes("compliance")) return "enterprise";
  if (lower.includes("developer") || lower.includes("api") || lower.includes("cli") || lower.includes("sdk")) return "technical";
  if (lower.includes("consumer") || lower.includes("playful") || lower.includes("fun")) return "playful";
  if (lower.includes("authoritative") || lower.includes("expert")) return "authoritative";
  return "friendly";
}

function guessPrimaryFriction(context: string): string {
  const lower = context.toLowerCase();
  if (lower.includes("activation") || lower.includes("onboarding")) return "operator indicates friction at activation / first-value";
  if (lower.includes("pricing") || lower.includes("paywall")) return "friction likely at pricing transition / conversion";
  if (lower.includes("procurement") || lower.includes("long sales cycle")) return "friction at enterprise procurement";
  if (lower.includes("integration") || lower.includes("setup")) return "friction at integration / initial setup";
  return "friction point not clearly specified — infer from GTM stage";
}

function guessDifferentiator(context: string): string {
  const trimmed = context.trim();
  if (trimmed.length === 0) return "differentiator not surfaced in enrichment";
  // Take the first sentence as a best-effort differentiator hypothesis.
  const firstSentence = trimmed.split(/[.!?]\s/)[0];
  return firstSentence.length <= 200 ? firstSentence : firstSentence.slice(0, 197) + "...";
}

const ENRICHMENT_PROMPT_PREFIX = `You are running Phase 1 of Operator Ω onboarding. The operator supplied a URL or git repo for their company. Your job is a thorough deep-dive enrichment so every downstream phase has rich, specific signal to reason about.

DEEP-DIVE PROTOCOL — when given a URL:
- Fetch the homepage. Then follow at least: /about, /pricing, /docs (or /developers), /customers, /careers if any of these are linked. For repos, read the README + any /docs and the package.json/manifest.
- Synthesize ACROSS pages. Cross-reference what marketing copy says with what the pricing page implies and what the docs reveal.
- Extract concrete specifics: customer logos / segments named, headline metrics, technology choices, feature lists, founding story, geographic focus.
- Be evidence-driven, not generic. If the site clearly says "we sell embroidery machines to small custom-apparel businesses with hardware financing and a Chroma SaaS," that's the kind of specificity to capture — NOT a generic "they sell software."

Return JSON with this exact shape:
{
  "company_context": "200-300 words — what the company does, who it serves, how it makes money, what's distinctive. Concrete and evidence-driven from the pages you read. Mention specific products, customer types, headline metrics, geography, and any notable bundles or partnerships.",
  "industry_hint": "b2b_saas|b2c|dev_tools|marketplace|ecommerce|fintech|healthtech|edtech|legal_tech|logistics_tech|consumer_mobile|services_to_saas|dev_infrastructure|fintech_retail|enterprise_saas|consumer_ai|consumer_hardware|unknown",
  "business_model_hint": "subscription|usage_based|one_time|marketplace|open_core|unknown",
  "ideal_customer_profile": "≤60 chars, who the product serves (e.g. 'enterprise ops teams', 'solo law firms', 'DTC brands')",
  "revenue_model": "≤40 chars, how money is made (e.g. 'subscription seat', 'usage-based', 'take-rate marketplace')",
  "competitive_position": "category leader | vertical specialist | niche | emerging | unvalidated",
  "primary_acquisition_channel": "content seo | outbound sales | referral | paid ads | partnerships | waitlist | community-led | creator-led",
  "product_maturity_signal": "pre_mvp | mvp | ga | mature | legacy",
  "tone_signal": "technical | friendly | authoritative | playful | enterprise",
  "primary_friction_hypothesis": "≤200 chars — your best inference about where this operator's customers hit friction (activation, pricing, integration, procurement, etc.)",
  "differentiator_hypothesis": "≤200 chars — what you think makes this operator distinct from direct peers in their category"
}

Genuinely couldn't fetch the URL after following links? Say so explicitly in company_context (start with "Could not fetch:") and leave structured fields as "unspecified". Otherwise, ALWAYS produce a rich, evidence-driven 200-300 word context — there is essentially always enough on a real company website to write that.

URL / repo:`;

export async function handlePillar1(input: Pillar1Input): Promise<Pillar1Response> {
  const enrichedAt = new Date().toISOString();

  if (input.deterministicOverride) {
    const o = input.deterministicOverride;
    const ctx = o.company_context ?? "";
    // Apply heuristics to any structured field the override left undefined —
    // so the override path produces the same downstream shape as the T2 path.
    return {
      ...o,
      enrichment_status: o.enrichment_status ?? "enriched",
      ideal_customer_profile: o.ideal_customer_profile ?? guessIdealCustomerProfile(ctx),
      revenue_model: o.revenue_model ?? guessRevenueModel(ctx, o.business_model_hint),
      competitive_position: o.competitive_position ?? guessCompetitivePosition(ctx),
      primary_acquisition_channel: o.primary_acquisition_channel ?? guessPrimaryAcquisitionChannel(ctx),
      product_maturity_signal: o.product_maturity_signal ?? guessProductMaturity(ctx),
      tone_signal: o.tone_signal ?? guessTone(ctx),
      primary_friction_hypothesis: o.primary_friction_hypothesis ?? guessPrimaryFriction(ctx),
      differentiator_hypothesis: o.differentiator_hypothesis ?? guessDifferentiator(ctx),
      enriched_at: enrichedAt,
    };
  }

  const trimmed = input.raw_input.trim();

  // Manual-capture path: operator supplied the context directly after a prior
  // enrichment attempt failed. We accept whatever they typed and mark the
  // response as low-confidence via enrichment_status.
  if (input.manual_context && input.manual_context.trim().length >= 40) {
    const ctx = input.manual_context.trim();
    return {
      org_name: input.org_name,
      company_context: ctx.slice(0, 1200),
      enrichment_status: "manual_capture",
      has_product: true,
      industry_hint: guessIndustryHint(ctx),
      business_model_hint: guessBusinessModelHint(ctx),
      ideal_customer_profile: guessIdealCustomerProfile(ctx),
      revenue_model: guessRevenueModel(ctx, guessBusinessModelHint(ctx)),
      competitive_position: guessCompetitivePosition(ctx),
      primary_acquisition_channel: guessPrimaryAcquisitionChannel(ctx),
      product_maturity_signal: guessProductMaturity(ctx),
      tone_signal: guessTone(ctx),
      primary_friction_hypothesis: guessPrimaryFriction(ctx),
      differentiator_hypothesis: guessDifferentiator(ctx),
      raw_input: trimmed,
      enriched_at: enrichedAt,
    };
  }

  if (looksLikeNoProduct(trimmed)) {
    return {
      org_name: input.org_name,
      company_context: "Pre-product — operator has not shipped anything yet. Phase 3 validation branch applies.",
      enrichment_status: "pre_product",
      has_product: false,
      industry_hint: "unknown",
      business_model_hint: "unknown",
      ideal_customer_profile: "unspecified",
      revenue_model: "unspecified",
      competitive_position: "unvalidated",
      primary_acquisition_channel: "unspecified",
      product_maturity_signal: "pre_mvp",
      tone_signal: "friendly",
      primary_friction_hypothesis: "operator has no customers yet — friction is between idea and first-customer",
      differentiator_hypothesis: "operator has not yet articulated a differentiator",
      raw_input: trimmed,
      enriched_at: enrichedAt,
    };
  }

  let resp;
  try {
    resp = await route({
      agent_id: "onboarding.pillar-1",
      prompt: `${ENRICHMENT_PROMPT_PREFIX}\n${trimmed}`,
      task_metadata: {
        // Wavex-os relaxation (2026-05): bumped to "deep" + 180s timeout so
        // T2 has the budget to actually fetch + synthesize across multiple
        // pages per the deep-dive protocol in ENRICHMENT_PROMPT_PREFIX.
        creativity_required: false,
        customer_facing: false,
        reasoning_depth: "deep",
        priority: "high",
      },
      companyId: input.companyId,
      outputFormat: "json",
      timeout_ms: 180_000,
    });
  } catch (err) {
    throw new OnboardingHaltError({
      code: "PILLAR_1_ENRICHMENT_FAILED",
      operator_message:
        "We couldn't read your site to enrich your profile. In 2–3 sentences, tell us what your product does and who buys it.",
      engineer_detail: err instanceof Error ? err.message : String(err),
      allow_override: false,
    });
  }

  let context = resp.output.trim();
  let industryHint = "unknown";
  let businessModelHint = "subscription";
  let icp: string | null = null;
  let revenueModel: string | null = null;
  let competitivePosition: string | null = null;
  let primaryAcquisitionChannel: string | null = null;
  let productMaturity: ProductMaturity | null = null;
  let tone: ToneSignal | null = null;
  let friction: string | null = null;
  let differentiator: string | null = null;

  // Best effort JSON parse of the enrichment result.
  try {
    const match = context.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as {
        company_context?: string;
        industry_hint?: string;
        business_model_hint?: string;
        ideal_customer_profile?: string;
        revenue_model?: string;
        competitive_position?: string;
        primary_acquisition_channel?: string;
        product_maturity_signal?: string;
        tone_signal?: string;
        primary_friction_hypothesis?: string;
        differentiator_hypothesis?: string;
      };
      if (parsed.company_context) context = parsed.company_context;
      if (parsed.industry_hint) industryHint = parsed.industry_hint;
      if (parsed.business_model_hint) businessModelHint = parsed.business_model_hint;
      if (parsed.ideal_customer_profile) icp = parsed.ideal_customer_profile;
      if (parsed.revenue_model) revenueModel = parsed.revenue_model;
      if (parsed.competitive_position) competitivePosition = parsed.competitive_position;
      if (parsed.primary_acquisition_channel) primaryAcquisitionChannel = parsed.primary_acquisition_channel;
      if (parsed.product_maturity_signal) productMaturity = parsed.product_maturity_signal as ProductMaturity;
      if (parsed.tone_signal) tone = parsed.tone_signal as ToneSignal;
      if (parsed.primary_friction_hypothesis) friction = parsed.primary_friction_hypothesis.slice(0, 200);
      if (parsed.differentiator_hypothesis) differentiator = parsed.differentiator_hypothesis.slice(0, 200);
    } else {
      industryHint = guessIndustryHint(context);
      businessModelHint = guessBusinessModelHint(context);
    }
  } catch {
    industryHint = guessIndustryHint(context);
    businessModelHint = guessBusinessModelHint(context);
  }

  // Meaningfulness gate: if T2 returned a placeholder or ate-my-dog response,
  // halt and route the operator through manual capture. Silent continuation
  // on empty context is what caused the WaveX imprint failure (F1).
  if (!isEnrichmentMeaningful(context)) {
    throw new OnboardingHaltError({
      code: "URL_ENRICHMENT_UNMEANINGFUL",
      operator_message:
        "We reached your site but couldn't extract anything useful. In 2–3 sentences, tell us what your product does and who buys it.",
      engineer_detail: `company_context too short or generic (len=${context.length})`,
      allow_override: false,
    });
  }

  // Fill any missing structured fields via heuristics — never leave them
  // undefined, because downstream phases read these directly into prompts.
  return {
    org_name: input.org_name,
    company_context: context.slice(0, 3000),
    enrichment_status: "enriched",
    has_product: true,
    industry_hint: industryHint,
    business_model_hint: businessModelHint,
    ideal_customer_profile: icp ?? guessIdealCustomerProfile(context),
    revenue_model: revenueModel ?? guessRevenueModel(context, businessModelHint),
    competitive_position: competitivePosition ?? guessCompetitivePosition(context),
    primary_acquisition_channel: primaryAcquisitionChannel ?? guessPrimaryAcquisitionChannel(context),
    product_maturity_signal: productMaturity ?? guessProductMaturity(context),
    tone_signal: tone ?? guessTone(context),
    primary_friction_hypothesis: friction ?? guessPrimaryFriction(context),
    differentiator_hypothesis: differentiator ?? guessDifferentiator(context),
    raw_input: trimmed,
    enriched_at: enrichedAt,
  };
}
