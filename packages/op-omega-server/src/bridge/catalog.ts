/** Catalog helpers — translate op-omega's 33 base-roster slots into the
 *  wavex agent-templates registry + the ergonomics the dashboard needs.
 *
 *  Slot taxonomies:
 *    - op-omega "slot" = dotted operational handle (e.g. cpo.build, cro.outbound)
 *    - wavex "templateId" = readable role from packages/agent-templates/_registry.json
 *      (e.g. backend-architect, growth-hacker, frontend-developer)
 *
 *  This file is the single source of truth for that bridge. When a new slot
 *  appears upstream OR a new specialist template lands in the registry, this
 *  is the file to edit.
 *
 *  All exports are pure functions / constants. No I/O. No DB. */

import { createHash } from "node:crypto";

/** 33-slot → templateId map. Justifications inline.
 *  Verified against packages/agent-templates/_registry.json (30 templates). */
export const SLOT_TO_TEMPLATE: Record<string, string> = {
  // L·II
  "ceo.orchestrator": "ceo",

  // Kernel: Chief of Staff. Sits between CEO and the C-suite line as the
  //   read-only fleet observer (see docs/MINIMAL_INCEPTION.md). Auto-injected
  //   by lib/kernel-slots.ts during swarm-manifest generation, so this entry
  //   exists primarily so templateIdForSlot resolves cleanly during bridge.
  "ceo.chief-of-staff": "chief-of-staff",

  // L·III chiefs (1:1 mapping)
  cpo: "cpo",
  cmo: "cmo",
  cro: "cro",
  cfo: "cfo",
  cdo: "cdo",
  coo: "coo",

  // L·IV Product
  "cpo.build": "backend-architect",
  "cpo.qa": "accessibility-auditor",
  "cpo.roadmap": "product-manager",
  "cpo.growth": "growth-hacker",

  // L·IV Marketing
  "cmo.demand": "growth-hacker",
  "cmo.content": "content-creator",
  "cmo.brand": "ad-creative-strategist",
  "cmo.advocacy": "content-creator",

  // L·IV Revenue
  "cro.outbound": "sales-coach",
  "cro.demo": "sales-engineer",
  "cro.close": "sales-coach",
  "cro.expansion": "sales-coach",

  // L·IV Finance
  "cfo.capital": "financial-analyst",
  "cfo.forecast": "financial-analyst",
  "cfo.treasury": "bookkeeper",
  "cfo.econ": "financial-analyst",

  // L·IV Data
  "cdo.signal": "ai-engineer",
  "cdo.attribute": "support-analytics",
  "cdo.telemetry": "support-analytics",
  "cdo.infer": "ai-engineer",

  // L·IV Ops
  "coo.health": "recovery-engineer",
  "coo.connector": "composio-integration",
  "coo.scheduler": "devops-engineer",
  "coo.memory": "devops-engineer",
  "coo.observability": "devops-engineer",
  "coo.dashboard": "frontend-developer",
  "coo.credentials": "composio-integration",
};

/** Tier classification for the throttle ladder + model selector.
 *    1 = ceo.orchestrator + ceo.chief-of-staff (kernel — always allowed
 *        under critical wake reasons; both run on opus per CoS provision script)
 *    2 = bare chiefs
 *    3 = dotted L·IV sub-agents */
export function tierForSlot(slot: string): 1 | 2 | 3 {
  if (slot === "ceo.orchestrator" || slot === "ceo.chief-of-staff") return 1;
  return slot.includes(".") ? 3 : 2;
}

/** Tier → claude model. Mirrors the schema default for unspecified tiers. */
export function modelForTier(tier: 1 | 2 | 3): string {
  if (tier === 1) return "claude-opus-4-6";
  return "claude-sonnet-4-6";
}

/** Look up the wavex template id for an op-omega slot. Falls back to the
 *  slot itself if a future slot lands without a mapping (defensive — keeps
 *  the bridge from inserting null template_id). */
export function templateIdForSlot(slot: string): string {
  return SLOT_TO_TEMPLATE[slot] ?? slot;
}

/** Human-readable agent name. "cpo.build" → "CPO · Build". */
export function slotToHumanName(slot: string): string {
  if (slot === "ceo.orchestrator") return "CEO Orchestrator";
  if (slot === "ceo.chief-of-staff") return "Chief of Staff";
  const parts = slot.split(".");
  if (parts.length === 1) return parts[0]!.toUpperCase();
  const [chief, suffix] = parts as [string, string];
  return `${chief.toUpperCase()} · ${suffix.charAt(0).toUpperCase() + suffix.slice(1)}`;
}

/** Deterministic agent id. Same companyId + slot ⇒ same id, so re-running
 *  the bridge upserts cleanly instead of inserting duplicates. */
export function agentIdForSlot(companyId: string, slot: string): string {
  return "ag_" + createHash("sha256").update(`${companyId}:${slot}`).digest("hex").slice(0, 16);
}
