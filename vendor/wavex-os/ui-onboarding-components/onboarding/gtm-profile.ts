/**
 * Client-side mirror of `deriveGtmProfile` for Pillar 4's resolved-profile preview.
 *
 * Source of truth: `packages/plugins/onboarding/src/phases/phase-1-onboard/pillar-4.ts`.
 * Keep in sync — Phase 2/3/4 generators key off `gtm_profile_enum`.
 */

export type GtmProfileEnum =
  | "INBOUND_PLG"
  | "INBOUND_MID_TOUCH"
  | "OUTBOUND_HIGH_TOUCH_SAAS"
  | "OUTBOUND_MID_MARKET"
  | "CONTENT_LED_PLG"
  | "REFERRAL_LED"
  | "BOOTSTRAP_NO_GTM"
  | "CUSTOM";

export function deriveGtmProfile(input: { lead_sources: string[]; sales_motion: string }): GtmProfileEnum {
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

const PROFILE_DISPLAY: Record<GtmProfileEnum, { name: string; primary_agents: string }> = {
  INBOUND_PLG: { name: "Inbound · Product-Led Growth", primary_agents: "cmo.demand + cmo.content active; cro sub-agents parked" },
  INBOUND_MID_TOUCH: { name: "Inbound · Mid-Touch", primary_agents: "cmo.demand + cmo.content + cro.demo + cro.close active" },
  OUTBOUND_HIGH_TOUCH_SAAS: { name: "Outbound · High-Touch Enterprise SaaS", primary_agents: "cro.outbound + cro.demo + cro.close + cmo.advocacy active" },
  OUTBOUND_MID_MARKET: { name: "Outbound · Mid-Market", primary_agents: "cro.outbound + cro.demo + cro.close active" },
  CONTENT_LED_PLG: { name: "Content-Led · Product-Led Growth", primary_agents: "cmo.content + cmo.brand + cmo.demand active" },
  REFERRAL_LED: { name: "Referral-Led", primary_agents: "cmo.advocacy + cmo.brand active" },
  BOOTSTRAP_NO_GTM: { name: "Bootstrap (no GTM motion yet)", primary_agents: "cmo / cro sub-agents parked until you adopt a motion" },
  CUSTOM: { name: "Custom blend", primary_agents: "Sub-agent activation derived per-rule from your selections" },
};

export function displayGtmProfile(profile: GtmProfileEnum): { name: string; primary_agents: string } {
  return PROFILE_DISPLAY[profile];
}
