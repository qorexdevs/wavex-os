/** Per-slot candidate templates. The matrix scorer evaluates each
 *  candidate against the company signals and picks the highest scorer.
 *
 *  Each list is the catalog default first (matches SLOT_TO_TEMPLATE today)
 *  + 3-7 plausible alternatives drawn from the same role bucket. Operators
 *  can still swap to ANY of the 165 templates via the swap UI; this list
 *  just constrains what the AUTOMATIC matrix considers, so we don't end up
 *  picking `bookkeeper` for `cdo.signal` due to a stray tag overlap. */

import { templateIdForSlot } from "../bridge/catalog.js";

const VARIATION_CANDIDATES: Record<string, string[]> = {
  // Product · QA — varies sharply by industry compliance / risk profile
  "cpo.qa": [
    "accessibility-auditor",  // catalog default
    "performance-benchmarker",
    "api-tester",
    "test-writer-fixer",
    "workflow-optimizer",
  ],

  // Data · signal — varies by industry data shape (ML / regulated / DTC)
  "cdo.signal": [
    "ai-engineer",            // catalog default
    "prompt-engineer",
    "mlops-engineer",
    "reality-checker",
    "data-engineer",
  ],

  // Marketing · brand — varies by GTM motion (paid vs referral vs community)
  "cmo.brand": [
    "ad-creative-strategist", // catalog default
    "brand-guardian",
    "story-architect",
    "content-creator",
  ],

  // Marketing · demand gen — varies by GTM motion + paid signal
  "cmo.demand": [
    "growth-hacker",          // catalog default
    "ppc-strategist",
    "seo-specialist",
    "community-builder",
  ],

  // Revenue · outbound — varies by sales motion + tooling
  "cro.outbound": [
    "sales-coach",            // catalog default
    "outbound-prospector",
  ],

  // Revenue · demo / SE — varies by deal size + complexity
  "cro.demo": [
    "sales-engineer",         // catalog default
    "solutions-architect",
  ],

  // Ops · health / recovery — varies by industry SLA expectations
  "coo.health": [
    "recovery-engineer",      // catalog default
    "incident-responder",
    "infrastructure-maintainer",
  ],

  // Ops · observability — varies by data emphasis
  "coo.observability": [
    "devops-engineer",        // catalog default
    "analytics-reporter",
  ],

  // Data · attribution — varies by paid vs product-led data emphasis
  "cdo.attribute": [
    "support-analytics",      // catalog default
    "growth-experiment-designer",
  ],
};

/** Returns the candidate list for a slot. Slots not in the variation map
 *  return [catalog_default] — the matrix has no choice, no per-company
 *  variation will happen for them. That's fine for C-suite + structural
 *  slots where role and template are 1:1. */
export function candidatesForSlot(slot: string): string[] {
  const explicit = VARIATION_CANDIDATES[slot];
  if (explicit && explicit.length > 0) return explicit;
  return [templateIdForSlot(slot)];
}

/** Catalog default per slot — matches templateIdForSlot(slot). The scorer
 *  uses this as a tiebreaker when multiple candidates score equally. */
export function defaultForSlot(slot: string): string {
  return templateIdForSlot(slot);
}
