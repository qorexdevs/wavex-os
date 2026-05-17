/** Deterministic matrix scorer. Picks the strongest template per slot
 *  given the company's pillar signals + connector manifest, by tag
 *  overlap with each candidate's affinities.
 *
 *  Scoring per (slot, template):
 *    score = w_industry * (1 if template.industries contains signal_industry else 0)
 *          + w_stage    * (1 if template.stages contains signal_stage       else 0)
 *          + w_gtm      * (1 if template.gtm contains signal_gtm            else 0)
 *          + w_connector* (count of required connectors in template.connectors / 3)
 *
 *  Default weights are equal-ish; tweak in TUNED_WEIGHTS if needed.
 *
 *  Tie-breaker: catalog default wins over a tied alternative — keeps the
 *  selection conservative (only pick alternatives when they SCORE HIGHER,
 *  not equal). */

import type { CompanyManifest } from "@wavex-os/plugin-onboarding";
import { affinitiesFor, type Industry, type Stage, type Gtm } from "./affinities.js";
import { candidatesForSlot, defaultForSlot } from "./candidates.js";

interface SignalContext {
  industries: Industry[];   // multiple to support fuzzy industry hints (e.g. ["regulated", "fintech"])
  stage: Stage | null;
  gtm: Gtm | null;
  requiredConnectors: Set<string>;
}

const TUNED_WEIGHTS = {
  industry: 0.35,
  stage: 0.20,
  gtm: 0.20,
  connector: 0.25,
};

/** Map pillar 1 industry hints + manual_context keywords to our internal
 *  Industry enum. Returns 1+ tags so e.g. a fintech company also gets the
 *  "regulated" tag and matches templates affinity-tagged for either. */
function deriveIndustries(manifest: CompanyManifest): Industry[] {
  const out = new Set<Industry>();
  const p1 = manifest.pillar_responses.pillar_1;
  const hint = (p1 as { industry_hint?: string }).industry_hint?.toLowerCase() ?? "";
  const ctx = ((p1 as { company_context?: string; manual_context?: string }).company_context
    ?? (p1 as { manual_context?: string }).manual_context ?? "").toLowerCase();

  // Direct hint mapping
  if (hint.includes("b2b_saas") || hint.includes("b2b-saas") || /\bsaas\b/.test(ctx) && /b2b|enterprise|teams?\b/.test(ctx)) out.add("saas-b2b");
  if (hint.includes("b2c_saas") || /b2c|consumer/.test(ctx)) out.add("saas-b2c");
  if (/marketplace|two-sided|matching/.test(ctx) || hint.includes("marketplace")) out.add("marketplace");
  if (/dtc|direct-to-consumer|ecommerce|e-commerce|shopify|skincare|brand/.test(ctx) || hint.includes("ecommerce")) out.add("ecommerce-dtc");
  if (/fintech|payments|banking|lending|stripe|plaid|pci|soc2/.test(ctx) || hint.includes("fintech")) {
    out.add("fintech"); out.add("regulated");
  }
  if (/healthtech|hipaa|clinical|patient|health system|medical|baa/.test(ctx) || hint.includes("health")) {
    out.add("healthtech"); out.add("regulated");
  }
  if (/edtech|k-12|district|curriculum|student|learning/.test(ctx) || hint.includes("edu")) out.add("edtech");
  if (/hardware|machine|manufactur|embroidery|device/.test(ctx) || hint.includes("hardware")) out.add("hardware");
  if (/agency|consult|services|retainer/.test(ctx) || hint.includes("agency")) out.add("agency-services");
  if (/open[- ]?source|github|community|contributors/.test(ctx) || hint.includes("oss") || hint.includes("open")) out.add("open-source");

  return [...out];
}

/** Map pillar 4 sales_motion + lead_sources to a GTM tag. */
function deriveGtm(manifest: CompanyManifest): Gtm | null {
  const p4 = manifest.pillar_responses.pillar_4;
  const motion = (p4 as { sales_motion?: string }).sales_motion ?? "";
  const sources: string[] = (p4 as { lead_sources?: string[] }).lead_sources ?? [];
  if (motion === "none_yet") return "none-yet";
  if (motion === "self_serve_plg") {
    // Distinguish self-serve from paid-led + community-led + referral-led
    if (sources.includes("inbound_ads_meta_google") && sources.length <= 2) return "paid-led";
    if (sources.includes("content_seo") && sources.length <= 2) return "community-led";
    if (sources.includes("referral_word_of_mouth") && sources.length <= 2) return "referral-led";
    return "self-serve";
  }
  if (motion === "high_touch_enterprise") return "high-touch-enterprise";
  if (motion === "assisted_demo") return "assisted-demo";
  return null;
}

function deriveStage(manifest: CompanyManifest): Stage | null {
  const stage = (manifest.pillar_responses.pillar_3 as { stage?: string }).stage;
  if (!stage) return null;
  return stage as Stage;
}

function buildContext(manifest: CompanyManifest): SignalContext {
  const reqIds = new Set(manifest.connector_manifest.required.map((e) => e.id));
  return {
    industries: deriveIndustries(manifest),
    stage: deriveStage(manifest),
    gtm: deriveGtm(manifest),
    requiredConnectors: reqIds,
  };
}

interface ScoredCandidate {
  templateId: string;
  score: number;
  matched: { industries: string[]; stages: string[]; gtm: string[]; connectors: string[] };
}

function scoreCandidate(templateId: string, ctx: SignalContext): ScoredCandidate {
  const aff = affinitiesFor(templateId);

  const matchedIndustries = ctx.industries.filter((i) => aff.industries.includes(i));
  const matchedStages = ctx.stage && aff.stages.includes(ctx.stage) ? [ctx.stage] : [];
  const matchedGtm = ctx.gtm && aff.gtm.includes(ctx.gtm) ? [ctx.gtm] : [];
  const matchedConnectors = aff.connectors.filter((c) => ctx.requiredConnectors.has(c));

  // Per-axis 0..1 normalized
  const industryScore = matchedIndustries.length > 0 ? Math.min(1, matchedIndustries.length / 2) : 0;
  const stageScore = matchedStages.length > 0 ? 1 : 0;
  const gtmScore = matchedGtm.length > 0 ? 1 : 0;
  const connectorScore = Math.min(1, matchedConnectors.length / 3);

  const score =
    TUNED_WEIGHTS.industry * industryScore +
    TUNED_WEIGHTS.stage * stageScore +
    TUNED_WEIGHTS.gtm * gtmScore +
    TUNED_WEIGHTS.connector * connectorScore;

  return {
    templateId, score,
    matched: {
      industries: matchedIndustries,
      stages: matchedStages,
      gtm: matchedGtm,
      connectors: matchedConnectors,
    },
  };
}

export interface SlotSelection {
  slot: string;
  chosenTemplateId: string;
  defaultTemplateId: string;
  /** True when the matrix picked something OTHER than the catalog default. */
  diverged: boolean;
  /** Score for the chosen pick (0..1). When 0, we fell back to default for lack of signal. */
  score: number;
  /** Human-readable reason. Designed to land in the manifest + show up in the swap UI. */
  rationale: string;
  /** Top 3 candidates with scores for transparency. */
  topCandidates: Array<{ templateId: string; score: number }>;
}

function rationaleFor(picked: ScoredCandidate, ctx: SignalContext, isDefault: boolean): string {
  if (isDefault && picked.score === 0) return "no signal — catalog default";
  const parts: string[] = [];
  if (picked.matched.industries.length > 0) parts.push(`industry fit (${picked.matched.industries.join(", ")})`);
  if (picked.matched.stages.length > 0) parts.push(`stage fit (${picked.matched.stages[0]})`);
  if (picked.matched.gtm.length > 0) parts.push(`GTM fit (${picked.matched.gtm[0]})`);
  if (picked.matched.connectors.length > 0) parts.push(`connector fit (${picked.matched.connectors.join(", ")})`);
  if (parts.length === 0) return isDefault ? "catalog default" : `chosen with score ${picked.score.toFixed(2)}`;
  // ctx unused in current message but reserved for future "vs alternatives" expansion
  void ctx;
  return parts.join(" + ");
}

/** Score every candidate for every slot in the swarm; return the chosen
 *  templateId + rationale per slot. Slots without explicit candidates just
 *  return the catalog default with no divergence. */
export function selectTemplatesForManifest(
  manifest: CompanyManifest,
): Map<string, SlotSelection> {
  const ctx = buildContext(manifest);
  const out = new Map<string, SlotSelection>();

  for (const slot of Object.keys(manifest.swarm_manifest.agents)) {
    const candidates = candidatesForSlot(slot);
    const def = defaultForSlot(slot);

    // No alternatives → trivial selection
    if (candidates.length === 1) {
      out.set(slot, {
        slot,
        chosenTemplateId: def,
        defaultTemplateId: def,
        diverged: false,
        score: 0,
        rationale: "no per-company variation defined for this slot",
        topCandidates: [{ templateId: def, score: 0 }],
      });
      continue;
    }

    const scored = candidates.map((c) => scoreCandidate(c, ctx));
    scored.sort((a, b) => b.score - a.score);

    // Tiebreaker: if top candidate's score equals catalog default's score,
    // prefer the catalog default (conservative — only pick alternative when
    // it strictly outscores).
    const top = scored[0]!;
    const defaultScored = scored.find((s) => s.templateId === def)!;
    let picked: ScoredCandidate;
    if (top.score > defaultScored.score) {
      picked = top;
    } else {
      picked = defaultScored;
    }

    const isDefault = picked.templateId === def;
    out.set(slot, {
      slot,
      chosenTemplateId: picked.templateId,
      defaultTemplateId: def,
      diverged: !isDefault,
      score: Math.round(picked.score * 100) / 100,
      rationale: rationaleFor(picked, ctx, isDefault),
      topCandidates: scored.slice(0, 3).map((s) => ({ templateId: s.templateId, score: Math.round(s.score * 100) / 100 })),
    });
  }

  return out;
}
