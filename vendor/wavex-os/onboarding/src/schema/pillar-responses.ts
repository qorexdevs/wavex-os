/**
 * Phase 1 output — pillar_responses.json.
 *
 * Everything after Phase 1 is a function of this object, so its shape is the
 * contract for the whole pipeline. Schema version bumps when we break back-
 * compat with earlier manifests.
 */

import type { KPISnapshot } from "@wavex-os/plugin-flywheel-kernel";

export const PILLAR_RESPONSES_SCHEMA_VERSION = "1.0";

export type EnrichmentStatus = "enriched" | "manual_capture" | "pre_product";

export interface Pillar1Response {
  org_name: string;
  /** Summary extracted from the URL/repo via T2 enrichment, or a self-described one-liner when pre-product. */
  company_context: string;
  /** How `company_context` was produced — drives `low_confidence` flags on the final manifest. */
  enrichment_status?: EnrichmentStatus;
  has_product: boolean;
  industry_hint: string;
  business_model_hint: string;
  /** Structured ICP summary (≤60 chars) — who the product serves. Downstream phases read this instead of company_context. */
  ideal_customer_profile?: string | null;
  /** How the company makes money (≤40 chars). E.g. "subscription seat", "usage-based", "take-rate marketplace", "one-time + repeat". */
  revenue_model?: string | null;
  /** Market position label (≤40 chars). E.g. "category leader", "vertical specialist", "niche", "emerging", "unvalidated". */
  competitive_position?: string | null;
  /** Primary acquisition channel (≤40 chars). E.g. "content seo", "outbound sales", "referral", "paid ads", "partnerships", "waitlist". */
  primary_acquisition_channel?: string | null;
  /**
   * Sprint 002 · Issue 5 · additional differentiation signals — force distinct
   * customizations between operators who share a GTM + stage but differ on
   * product maturity, tone, or their real friction/differentiator.
   */
  product_maturity_signal?: "pre_mvp" | "mvp" | "ga" | "mature" | "legacy" | null;
  tone_signal?: "technical" | "friendly" | "authoritative" | "playful" | "enterprise" | null;
  /** T2-inferred main friction the operator's customers hit. ≤200 chars. */
  primary_friction_hypothesis?: string | null;
  /** T2-inferred differentiator — what makes this operator unique vs peers. ≤200 chars. */
  differentiator_hypothesis?: string | null;
  /** Exact text the operator pasted — URL, repo, or "no product yet". */
  raw_input: string;
  /** Timestamp of last T2 enrichment — used to decide whether to re-fetch on re-run. */
  enriched_at: string;
  /**
   * NEW-C3.1 · Operator saw the enriched signals and confirmed or corrected
   * them before Phase 2. When `false`, downstream phases may flag
   * `low_confidence` because the operator hasn't vetted the inference.
   */
  inference_confirmed?: boolean;
  /**
   * NEW-C3.1 · Operator corrections to enriched signals. When present, these
   * values take precedence over the enriched ones for downstream phases.
   */
  inference_corrections?: {
    industry_hint?: string;
    business_model_hint?: string;
    has_product?: boolean;
  };
}

export type ClaudePlan = "max_20x" | "max_5x" | "api_only" | "other";
export type InferenceBudgetProfile = "premium" | "standard" | "conservative";

export interface Pillar2Response {
  claude_code_verified: boolean;
  claude_plan: ClaudePlan;
  claude_plan_other_note?: string;
  claude_version?: string;
  test_call_output?: string;
  inference_budget_profile: InferenceBudgetProfile;
  verified_at: string;
}

export type ProductState =
  | "live_paying_customers"
  | "built_not_selling"
  | "prototype_mvp"
  | "idea_only"
  | "other";

export interface Pillar3Response {
  product_state: ProductState;
  product_state_other?: string;
  /** String because the scale differs based on product_state. */
  stage: string;
  stage_other?: string;
  /** KPISnapshot with ai_estimated flag when we had to guess. */
  kpi_snapshot_initial: KPISnapshot & { ai_estimated: boolean };
}

export type LeadSource =
  | "inbound_ads_meta_google"
  | "outbound_cold"
  | "referral_word_of_mouth"
  | "content_seo"
  | "product_led_viral"
  | "partnerships"
  | "events"
  | "none_yet"
  | "other";

export type SalesMotion = "self_serve_plg" | "assisted_demo" | "high_touch_enterprise" | "none_yet" | "other";
export type CloseChannel = "mostly_phone_video" | "mostly_email_text" | "mixed" | "other";

export type GtmProfileEnum =
  | "INBOUND_PLG"
  | "INBOUND_MID_TOUCH"
  | "OUTBOUND_HIGH_TOUCH_SAAS"
  | "OUTBOUND_MID_MARKET"
  | "CONTENT_LED_PLG"
  | "REFERRAL_LED"
  | "BOOTSTRAP_NO_GTM"
  | "CUSTOM";

export interface Pillar4Response {
  /** Multi-select — at least 1, at most 3. First entry is the primary channel. */
  lead_sources: LeadSource[];
  lead_source_other?: string;
  sales_motion: SalesMotion;
  sales_motion_other?: string;
  close_channel?: CloseChannel;
  close_channel_other?: string;
  gtm_profile_enum: GtmProfileEnum;
  /**
   * @deprecated Use `lead_sources` (array). Retained for back-compat during the
   *   Sprint 002 migration — downstream code should read the array.
   */
  lead_source?: LeadSource;
}

export type CommChannel = "telegram" | "slack" | "sms" | "email_only" | "other";
export type UrgencyRouting = "all_to_one_channel" | "digest_plus_urgent_phone" | "other";

export interface Pillar5Response {
  comm_channel: CommChannel;
  comm_channel_other?: string;
  urgency_routing?: UrgencyRouting;
  urgency_routing_other?: string;
  /** Encrypted connector-level fields (webhook URL, chat_id, phone number) — operator supplies these in Phase 2 proper. For now the pillar captures that the channel was CHOSEN. */
  board_endpoint_config?: Record<string, string>;
}

export interface PillarResponses {
  schema_version: typeof PILLAR_RESPONSES_SCHEMA_VERSION;
  started_at: string;
  completed_at: string | null;
  pillar_1: Pillar1Response | null;
  pillar_2: Pillar2Response | null;
  pillar_3: Pillar3Response | null;
  pillar_4: Pillar4Response | null;
  pillar_5: Pillar5Response | null;
}

export function emptyPillarResponses(): PillarResponses {
  return {
    schema_version: PILLAR_RESPONSES_SCHEMA_VERSION,
    started_at: new Date().toISOString(),
    completed_at: null,
    pillar_1: null,
    pillar_2: null,
    pillar_3: null,
    pillar_4: null,
    pillar_5: null,
  };
}

export function isPillarResponsesComplete(r: PillarResponses): boolean {
  return Boolean(r.pillar_1 && r.pillar_2 && r.pillar_3 && r.pillar_4 && r.pillar_5);
}

/** Which pillar is the next one to fill in. Returns null when complete. */
export function nextIncompletePillar(r: PillarResponses): 1 | 2 | 3 | 4 | 5 | null {
  if (!r.pillar_1) return 1;
  if (!r.pillar_2) return 2;
  // Pillar 2 gates downstream.
  if (r.pillar_2 && !r.pillar_2.claude_code_verified) return 2;
  if (!r.pillar_3) return 3;
  if (!r.pillar_4) return 4;
  if (!r.pillar_5) return 5;
  return null;
}
