/**
 * Pillar 4 — GTM Motion. Plain storage of the operator's picks, plus a
 * derived `gtm_profile_enum` that Phase 2/3 generators key off of.
 */

import type {
  Pillar4Response,
  LeadSource,
  SalesMotion,
  CloseChannel,
  GtmProfileEnum,
} from "../../schema/pillar-responses.js";

export interface Pillar4Input {
  /** 1–3 selected lead sources; first is primary. */
  lead_sources: LeadSource[];
  lead_source_other?: string;
  sales_motion: SalesMotion;
  sales_motion_other?: string;
  close_channel?: CloseChannel;
  close_channel_other?: string;
}

/**
 * GTM profile is derived from the PRIMARY lead source + sales motion. Secondary
 * lead sources are carried through on the pillar response so Phase 2 connector
 * + Phase 3 swarm can union their rules (see `applyLeadSourceAdjustments`).
 */
export function deriveGtmProfile(input: Pillar4Input): GtmProfileEnum {
  const ls = input.lead_sources[0] ?? "none_yet";
  const sm = input.sales_motion;

  if (sm === "none_yet" || ls === "none_yet") return "BOOTSTRAP_NO_GTM";
  if (ls === "inbound_ads_meta_google" && sm === "self_serve_plg") return "INBOUND_PLG";
  if (ls === "inbound_ads_meta_google" && sm === "assisted_demo") return "INBOUND_MID_TOUCH";
  if (ls === "outbound_cold" && sm === "high_touch_enterprise") return "OUTBOUND_HIGH_TOUCH_SAAS";
  if (ls === "outbound_cold" && sm === "assisted_demo") return "OUTBOUND_MID_MARKET";
  if (ls === "content_seo" && (sm === "self_serve_plg" || sm === "assisted_demo")) return "CONTENT_LED_PLG";
  if (ls === "referral_word_of_mouth") return "REFERRAL_LED";
  if (ls === "product_led_viral") return "INBOUND_PLG";
  if (ls === "partnerships") return "REFERRAL_LED";
  return "CUSTOM";
}

export async function handlePillar4(input: Pillar4Input): Promise<Pillar4Response> {
  return {
    lead_sources: input.lead_sources,
    lead_source: input.lead_sources[0],  // back-compat; primary channel.
    lead_source_other: input.lead_source_other,
    sales_motion: input.sales_motion,
    sales_motion_other: input.sales_motion_other,
    close_channel: input.close_channel,
    close_channel_other: input.close_channel_other,
    gtm_profile_enum: deriveGtmProfile(input),
  };
}
