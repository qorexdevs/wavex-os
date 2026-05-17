/** Slot → templateId map (CLIENT mirror).
 *
 *  CANONICAL SOURCE: packages/wavex-os-server/src/bridge/catalog.ts SLOT_TO_TEMPLATE.
 *  The server uses this at activation time to project wavex-os's 33 dotted slots
 *  onto the wavex agent-templates registry. The client mirrors it so views that
 *  consume manifest.swarm_manifest.agents (Phase 3) can render with the same
 *  display name + origin badge that the post-Activate FleetGraph shows.
 *
 *  When updating, edit BOTH files. */

export const SLOT_TO_TEMPLATE: Record<string, string> = {
  // L·II
  "ceo.orchestrator": "ceo",

  // L·III chiefs
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

export function templateIdForSlot(slot: string): string {
  return SLOT_TO_TEMPLATE[slot] ?? slot;
}

/** ceo.orchestrator → 1; bare chiefs → 2; dotted L·IV → 3. */
export function tierForSlot(slot: string): 1 | 2 | 3 {
  if (slot === "ceo.orchestrator") return 1;
  return slot.includes(".") ? 3 : 2;
}
