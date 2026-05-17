/**
 * The 33-agent base roster (Board = human, excluded from agent count).
 * Uses v1.0-compatible naming: `ceo.orchestrator` + bare chief names +
 * dotted sub-agents. Sub-agent tree below each chief. The S+ markers
 * follow OPΩ-SPEC §2.3.
 */

import type {
  AgentManifestEntry,
  AgentDepartment,
  AgentLevel,
} from "../../schema/swarm-manifest.js";

export interface BaseRosterEntry extends AgentManifestEntry {
  id: string;
}

const DEFAULT_ADAPTER = "claude-code";

function entry(
  id: string,
  department: AgentDepartment,
  level: AgentLevel,
  reports_to: string | null,
  spawnable: boolean,
  heartbeat: string,
  budget: number,
): BaseRosterEntry {
  return {
    id,
    status: "active",
    adapter: DEFAULT_ADAPTER,
    heartbeat,
    budget_monthly_usd: budget,
    skill_overlay: null,
    department,
    level,
    reports_to,
    spawnable,
  };
}

// @tunable phase3.base_roster
export const BASE_ROSTER: BaseRosterEntry[] = [
  // L·II CEO
  entry("ceo.orchestrator", "ceo", "L·II", null, false, "15m", 300),

  // L·III chiefs
  entry("cpo", "product", "L·III", "ceo.orchestrator", false, "1h", 120),
  entry("cmo", "marketing", "L·III", "ceo.orchestrator", false, "1h", 120),
  entry("cro", "revenue", "L·III", "ceo.orchestrator", false, "1h", 120),
  entry("cfo", "finance", "L·III", "ceo.orchestrator", false, "1h", 120),
  entry("cdo", "data", "L·III", "ceo.orchestrator", false, "1h", 120),
  entry("coo", "ops", "L·III", "ceo.orchestrator", false, "1h", 120),

  // L·IV Product sub-agents (v1.2 §4.1: build, qa, roadmap, growth)
  entry("cpo.build", "product", "L·IV", "cpo", true, "2h", 80),
  entry("cpo.qa", "product", "L·IV", "cpo", false, "4h", 60),
  entry("cpo.roadmap", "product", "L·IV", "cpo", false, "1d", 60),
  entry("cpo.growth", "product", "L·IV", "cpo", true, "2h", 80),

  // L·IV Marketing sub-agents
  entry("cmo.demand", "marketing", "L·IV", "cmo", true, "2h", 80),
  entry("cmo.content", "marketing", "L·IV", "cmo", true, "4h", 80),
  entry("cmo.brand", "marketing", "L·IV", "cmo", false, "1d", 60),
  entry("cmo.advocacy", "marketing", "L·IV", "cmo", false, "6h", 60),

  // L·IV Revenue sub-agents
  entry("cro.outbound", "revenue", "L·IV", "cro", true, "2h", 80),
  entry("cro.demo", "revenue", "L·IV", "cro", false, "4h", 60),
  entry("cro.close", "revenue", "L·IV", "cro", false, "2h", 80),
  entry("cro.expansion", "revenue", "L·IV", "cro", true, "6h", 80),

  // L·IV Finance sub-agents (v1.2 §4.1: capital, forecast, treasury, econ)
  entry("cfo.capital", "finance", "L·IV", "cfo", false, "1h", 80),
  entry("cfo.forecast", "finance", "L·IV", "cfo", false, "4h", 60),
  entry("cfo.treasury", "finance", "L·IV", "cfo", false, "1d", 60),
  entry("cfo.econ", "finance", "L·IV", "cfo", false, "1d", 60),

  // L·IV Data sub-agents
  entry("cdo.signal", "data", "L·IV", "cdo", true, "1h", 80),
  entry("cdo.attribute", "data", "L·IV", "cdo", false, "4h", 60),
  entry("cdo.telemetry", "data", "L·IV", "cdo", false, "2h", 60),
  entry("cdo.infer", "data", "L·IV", "cdo", true, "6h", 80),

  // L·IV Ops sub-agents
  entry("coo.health", "ops", "L·IV", "coo", false, "15m", 40),
  entry("coo.connector", "ops", "L·IV", "coo", false, "1h", 40),
  entry("coo.scheduler", "ops", "L·IV", "coo", false, "15m", 40),
  entry("coo.memory", "ops", "L·IV", "coo", false, "1d", 40),
  entry("coo.observability", "ops", "L·IV", "coo", false, "1h", 0),
  entry("coo.dashboard", "ops", "L·IV", "coo", false, "1h", 0),

  // L·IV Credential custodian (Credential Concierge integration).
  // Ships DORMANT: rotation logic feature-flagged via COO_CREDENTIALS_ROTATION_ENABLED;
  // only expiry checks + validation freshness fire on the daily heartbeat in cycle-0.
  entry("coo.credentials", "ops", "L·IV", "coo", false, "1d", 5),
];

// @tunable phase3.base_roster_size
export const BASE_ROSTER_SIZE = BASE_ROSTER.length; // = 33

/** Returns an index keyed by id for O(1) lookup. */
export function rosterIndex(): Map<string, BaseRosterEntry> {
  return new Map(BASE_ROSTER.map((a) => [a.id, a]));
}
