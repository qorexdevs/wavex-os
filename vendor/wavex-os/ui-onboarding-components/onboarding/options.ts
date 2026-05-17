/**
 * Static option lists for pillars 3, 4, 5.
 *
 * Each option's `v` is the wire-format value sent to the server; `l` is the
 * operator-facing label rendered in the UI.
 */

export const PRODUCT_STATES = [
  { v: "live_paying_customers", l: "Live with paying customers" },
  { v: "built_not_selling", l: "Built but not selling yet" },
  { v: "prototype_mvp", l: "Prototype / MVP" },
  { v: "idea_only", l: "Idea only, no build" },
  { v: "other", l: "Other — specify" },
] as const;

export const STAGE_REVENUE = [
  { v: "less_than_10k_mrr", l: "< $10k MRR" },
  { v: "10k_100k_mrr", l: "$10k – $100k MRR" },
  { v: "100k_1m_mrr", l: "$100k – $1M MRR" },
  { v: "more_than_1m_mrr", l: "> $1M MRR" },
  { v: "other", l: "Other — specify" },
] as const;

export const STAGE_PRE = [
  { v: "pre_product", l: "Pre-product" },
  { v: "pre_launch", l: "Pre-launch" },
  { v: "soft_launched", l: "Soft-launched" },
  { v: "other", l: "Other — specify" },
] as const;

export const LEAD_SOURCES = [
  { v: "inbound_ads_meta_google", l: "Inbound ads (Meta/Google)" },
  { v: "outbound_cold", l: "Outbound (cold email/call)" },
  { v: "referral_word_of_mouth", l: "Referral / word-of-mouth" },
  { v: "content_seo", l: "Content / SEO" },
  { v: "product_led_viral", l: "Product-led / viral" },
  { v: "partnerships", l: "Partnerships" },
  { v: "events", l: "Events" },
  { v: "none_yet", l: "None yet" },
  { v: "other", l: "Other — specify" },
] as const;

export const SALES_MOTIONS = [
  { v: "self_serve_plg", l: "Self-serve / PLG" },
  { v: "assisted_demo", l: "Assisted (demo required)" },
  { v: "high_touch_enterprise", l: "High-touch enterprise" },
  { v: "none_yet", l: "None yet" },
  { v: "other", l: "Other — specify" },
] as const;

export const CLOSE_CHANNELS = [
  { v: "mostly_phone_video", l: "Mostly phone / video" },
  { v: "mostly_email_text", l: "Mostly email / text" },
  { v: "mixed", l: "Mixed" },
  { v: "other", l: "Other — specify" },
] as const;

export const COMM_CHANNELS = [
  { v: "telegram", l: "Telegram" },
  { v: "slack", l: "Slack" },
  { v: "sms", l: "SMS" },
  { v: "email_only", l: "Email only" },
  { v: "other", l: "Other — specify" },
] as const;

export const URGENCY_ROUTES = [
  { v: "all_to_one_channel", l: "All messages to one channel" },
  { v: "digest_plus_urgent_phone", l: "Daily digest + urgent to phone" },
  { v: "other", l: "Other — specify" },
] as const;
