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
    "accessibility-auditor", "performance-benchmarker", "api-tester",
    "test-writer-fixer", "workflow-optimizer", "evidence-collector",
    "tracking-specialist",
  ],

  // Product · build — varies by product surface (backend/frontend/mobile)
  "cpo.build": [
    "backend-architect", "frontend-developer", "mobile-app-builder",
    "ai-engineer",
  ],

  // Product · roadmap — varies by stage + complexity
  "cpo.roadmap": [
    "product-manager", "ux-architect", "feedback-synthesizer",
    "trend-researcher",
  ],

  // Product · growth — varies by paid vs PLG vs community
  "cpo.growth": [
    "growth-hacker", "behavioral-nudge-engine", "experiment-tracker",
  ],

  // Data · signal — varies by industry data shape (ML / regulated / DTC)
  "cdo.signal": [
    "ai-engineer", "prompt-engineer", "mlops-engineer",
    "reality-checker", "data-engineer",
  ],

  // Data · attribution — paid-led vs product-led
  "cdo.attribute": [
    "support-analytics", "growth-experiment-designer", "tracking-specialist",
    "search-query-analyst",
  ],

  // Data · telemetry — varies by org maturity + data shape
  "cdo.telemetry": [
    "support-analytics", "data-engineer", "analytics-reporter",
  ],

  // Data · inference — usually ai-engineer; could be prompt for regulated
  "cdo.infer": [
    "ai-engineer", "prompt-engineer", "image-prompt-engineer",
  ],

  // Marketing · brand — varies by GTM motion (paid vs referral vs community)
  "cmo.brand": [
    "ad-creative-strategist", "brand-guardian", "story-architect",
    "content-creator",
  ],

  // Marketing · content — varies by audience (technical vs consumer)
  "cmo.content": [
    "content-creator", "story-architect",
  ],

  // Marketing · demand gen — varies by GTM motion + paid signal
  "cmo.demand": [
    "growth-hacker", "ppc-strategist", "seo-specialist", "community-builder",
    "paid-social-strategist", "programmatic-buyer",
  ],

  // Marketing · advocacy — varies by community shape
  "cmo.advocacy": [
    "content-creator", "community-builder", "brand-guardian",
  ],

  // Revenue · outbound — varies by sales motion + tooling
  "cro.outbound": [
    "sales-coach", "outbound-prospector", "account-strategist",
  ],

  // Revenue · demo / SE — varies by deal size + complexity
  "cro.demo": [
    "sales-engineer", "solutions-architect",
  ],

  // Revenue · close — varies by deal complexity
  "cro.close": [
    "sales-coach", "deal-strategist", "account-strategist",
  ],

  // Revenue · expansion — varies by motion (CSM vs sales)
  "cro.expansion": [
    "sales-coach", "account-strategist",
  ],

  // Finance · capital — fundraising / treasury / unit-econ
  "cfo.capital": [
    "financial-analyst", "investment-researcher", "fpa-analyst",
  ],

  // Finance · forecast — modeling / scenarios
  "cfo.forecast": [
    "financial-analyst", "fpa-analyst",
  ],

  // Finance · treasury — bookkeeping / controllership
  "cfo.treasury": [
    "bookkeeper", "tax-strategist",
  ],

  // Finance · econ — unit economics / pricing
  "cfo.econ": [
    "financial-analyst", "fpa-analyst",
  ],

  // Ops · health / recovery — varies by industry SLA expectations
  "coo.health": [
    "recovery-engineer", "incident-responder", "infrastructure-maintainer",
  ],

  // Ops · observability — varies by data emphasis
  "coo.observability": [
    "devops-engineer", "analytics-reporter",
  ],

  // Ops · scheduler — automation depth varies
  "coo.scheduler": [
    "devops-engineer", "experiment-tracker",
  ],

  // Ops · memory — knowledge surface varies
  "coo.memory": [
    "devops-engineer", "feedback-synthesizer", "executive-summary-generator",
  ],

  // Ops · dashboard — frontend vs analytics surface
  "coo.dashboard": [
    "frontend-developer", "ui-designer", "analytics-reporter",
  ],

  // Ops · connector / credentials — composio vs security split
  "coo.connector": [
    "composio-integration",
  ],
  "coo.credentials": [
    "composio-integration",
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
