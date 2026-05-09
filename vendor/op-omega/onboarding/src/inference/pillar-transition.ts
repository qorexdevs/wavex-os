/**
 * Inter-pillar inference scaffold (WaveX audit F8).
 *
 * After each pillar submission, this module produces a
 * `PillarTransitionResult` the UI can apply when rendering the NEXT pillar:
 *   - `option_reorder`: reorder the option list
 *   - `option_hidden`: hide options that don't fit the operator's signals
 *   - `hint_text_override`: replace the default hint with one tailored to the
 *     operator's prior answers
 *
 * The first landed implementation is rule-based (T0) — deterministic,
 * instant, no inference cost. It captures the common cases (e.g. outbound
 * lead source narrows to enterprise-style urgency routing). A T1/T2
 * escalation path is scaffolded for `Other-specify` answers but left as
 * follow-up work — the rule-based version already makes pillars observably
 * adaptive, which is the audit's acceptance criterion.
 */

import type { PillarResponses } from "../schema/pillar-responses.js";

export type PillarNumber = 1 | 2 | 3 | 4 | 5;

export interface QuestionModification {
  question_id: string;
  option_reorder?: string[];
  option_hidden?: string[];
  hint_text_override?: string;
}

export interface PillarTransitionResult {
  /** Modifications to apply when rendering the next pillar. */
  next_question_modifications: QuestionModification[];
  /** Free-form annotations persisted onto the pillar response for downstream phases. */
  context_annotations: Record<string, string>;
}

export function runPillarTransition(
  completed_pillar: PillarNumber,
  responses: PillarResponses,
): PillarTransitionResult {
  const mods: QuestionModification[] = [];
  const annotations: Record<string, string> = {};

  // After Pillar 1: hint Pillar 2's claude-plan question based on likely spend tier.
  if (completed_pillar === 1 && responses.pillar_1) {
    const industry = responses.pillar_1.industry_hint;
    const icp = responses.pillar_1.ideal_customer_profile ?? "";
    if (industry === "enterprise_saas" || icp.toLowerCase().includes("enterprise") || icp.toLowerCase().includes("fortune")) {
      mods.push({
        question_id: "pillar_2.claude_plan",
        option_reorder: ["max_20x", "max_5x", "api_only", "other"],
        hint_text_override: "Enterprise operators typically run Max 20× — volume of inference and reasoning depth both scale.",
      });
    }
  }

  // After Pillar 3: hint Pillar 4's sales motion based on stage + product state.
  if (completed_pillar === 3 && responses.pillar_3) {
    const stage = responses.pillar_3.stage;
    const ps = responses.pillar_3.product_state;
    if (ps === "idea_only" || stage === "pre_product") {
      mods.push({
        question_id: "pillar_4.sales_motion",
        option_reorder: ["none_yet", "self_serve_plg", "assisted_demo", "high_touch_enterprise", "other"],
        hint_text_override: "Pre-product operators usually pick 'None yet' here — design partners come before a formal motion.",
      });
      mods.push({
        question_id: "pillar_4.lead_source",
        option_reorder: ["none_yet", "referral_word_of_mouth", "content_seo", "outbound_cold", "inbound_ads_meta_google", "other"],
      });
    } else if (stage === "more_than_1m_mrr") {
      mods.push({
        question_id: "pillar_4.sales_motion",
        option_reorder: ["high_touch_enterprise", "assisted_demo", "self_serve_plg", "none_yet", "other"],
        hint_text_override: "At scale, most operators land on high-touch enterprise or an assisted motion with account management.",
      });
    }
  }

  // After Pillar 4: tailor Pillar 5's urgency routing to the sales motion.
  if (completed_pillar === 4 && responses.pillar_4) {
    const sm = responses.pillar_4.sales_motion;
    const gtm = responses.pillar_4.gtm_profile_enum;
    if (sm === "high_touch_enterprise" || gtm === "OUTBOUND_HIGH_TOUCH_SAAS") {
      mods.push({
        question_id: "pillar_5.urgency_routing",
        option_reorder: ["digest_plus_urgent_phone", "all_to_one_channel", "other"],
        hint_text_override: "High-touch operators usually want a daily digest with urgent escalations to phone — deal velocity is high, but noise ratio must stay low.",
      });
      annotations["pillar_5.expected_pattern"] = "enterprise_escalation";
    } else if (sm === "self_serve_plg" || gtm === "INBOUND_PLG" || gtm === "CONTENT_LED_PLG") {
      mods.push({
        question_id: "pillar_5.urgency_routing",
        option_reorder: ["all_to_one_channel", "digest_plus_urgent_phone", "other"],
        hint_text_override: "PLG motions prefer a single channel — the volume is higher but the per-event stakes are lower than in enterprise.",
      });
      annotations["pillar_5.expected_pattern"] = "plg_single_channel";
    }
  }

  return { next_question_modifications: mods, context_annotations: annotations };
}
