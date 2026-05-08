/**
 * Fleet assessment markdown synthesizer.
 *
 * Pure-SQL synthesis (no LLM calls). Consumes the data plane that
 * `mission-control.ts` and `bottlenecks.ts` already query. Produces a
 * markdown report intended to be:
 *   1. Read directly by the Chief of Staff at start of each 4h routine
 *      (its primary input — see SKILL_FLEET_ALIGNMENT).
 *   2. Cached to disk by a launchd job for offline / mobile reading.
 *
 * The full Paperclip implementation (~450 LOC) renders 6 sections:
 *   - activity (heartbeats, runs, closed issues)
 *   - deliverables (artifacts shipped this window)
 *   - kpi alignment (movements + ownership gaps)
 *   - forecast accuracy (per-agent attribution rollup)
 *   - kpi movement (deltas vs window start)
 *   - orchestration flags (spinners, retried runs, OAuth events)
 *
 * This package ships the framing + types + a slim default renderer.
 * Extend it by passing your own section renderers via `buildFleetAssessment`.
 */
import type { DbExecutor } from "./types.js";
import { computeBottlenecks } from "./bottlenecks.js";
import { getMissionControl, type MissionControlResponse } from "./mission-control.js";

export type FleetAssessmentSections = {
  activity?: (mc: MissionControlResponse) => string;
  deliverables?: (mc: MissionControlResponse) => string;
  kpiAlignment?: (mc: MissionControlResponse) => string;
  forecastAccuracy?: (mc: MissionControlResponse) => string;
  kpiMovement?: (mc: MissionControlResponse) => string;
  flags?: (mc: MissionControlResponse) => string;
};

export type FleetAssessmentOptions = {
  windowHours?: number;
  sections?: FleetAssessmentSections;
};

const defaultSections: Required<FleetAssessmentSections> = {
  activity: (mc) => {
    const { fleetTotals } = mc;
    return [
      `## Activity (last 24h)`,
      ``,
      `- Agents tracked: **${fleetTotals.agents}**`,
      `- Heartbeat runs: **${fleetTotals.runs24h}**`,
      `- Closed issues: **${fleetTotals.done24h}**`,
      `- Comments: **${fleetTotals.comments24h}**`,
      `- Imputed burn: **$${(fleetTotals.burnCents24h / 100).toFixed(2)}**`,
    ].join("\n");
  },
  deliverables: (mc) => {
    return [
      `## Deliverables`,
      ``,
      mc.fleetTotals.done24h === 0
        ? `- No closed issues in last 24h. **This is a flag.**`
        : `- ${mc.fleetTotals.done24h} closed issues in last 24h.`,
    ].join("\n");
  },
  kpiAlignment: (mc) => {
    const lines = [`## KPI alignment`, ``];
    if (mc.bottlenecks.length === 0) {
      lines.push(`- No bottlenecks scored above 0.`);
    } else {
      for (const [i, b] of mc.bottlenecks.slice(0, 5).entries()) {
        lines.push(
          `${i + 1}. **${b.label}** — score ${b.score} · gap ${(b.gapNormalized * 100).toFixed(0)}% · stale ${b.stalenessDays}d · owner ${b.ownerName ?? "(unowned)"}`,
        );
      }
    }
    return lines.join("\n");
  },
  forecastAccuracy: () => {
    return [
      `## Forecast accuracy`,
      ``,
      `_Pass per-agent attribution rollup data via a custom section to populate this._`,
    ].join("\n");
  },
  kpiMovement: (mc) => {
    const lines = [`## KPI movement (last 24h)`, ``];
    for (const g of mc.goalProgress) {
      const delta =
        g.delta24h == null ? "no prior snapshot" : `Δ24h = ${g.delta24h.toFixed(2)}`;
      const pct = g.pctOfTarget == null ? "" : ` · ${g.pctOfTarget.toFixed(1)}% of target`;
      lines.push(`- **${g.label}**: ${g.currentValue ?? "?"}${pct} · ${delta}`);
    }
    return lines.join("\n");
  },
  flags: (mc) => {
    const lines = [`## Flags`, ``];
    if (mc.spinners.length > 0) {
      lines.push(`### Spinners (≥5 runs, 0 done in 24h)`);
      for (const s of mc.spinners) {
        lines.push(`- ${s.name} (${s.role ?? "?"}) · ${s.runs24h} runs · $${(s.burnCents24h / 100).toFixed(2)} burn`);
      }
    }
    if (mc.bottlenecks.some((b) => b.ownerAgentId === null)) {
      lines.push(``, `### Unowned KPIs`);
      for (const b of mc.bottlenecks.filter((b) => b.ownerAgentId === null)) {
        lines.push(`- ${b.label}`);
      }
    }
    if (lines.length === 2) lines.push(`- No flags raised.`);
    return lines.join("\n");
  },
};

export async function buildFleetAssessment(
  db: DbExecutor,
  companyId: string,
  opts: FleetAssessmentOptions = {},
): Promise<string> {
  const mc = await getMissionControl(db, companyId, { force: true });
  // computeBottlenecks is already inside mc.bottlenecks, but the broader
  // assessment may want the full ranked list (mission-control caps at 5).
  // We re-fetch with a higher limit for the 'kpi alignment' section if the
  // user has overridden it.
  if (opts.sections?.kpiAlignment) {
    const full = await computeBottlenecks(db, companyId, 25);
    mc.bottlenecks = full;
  }

  const sections = { ...defaultSections, ...opts.sections };
  const ts = new Date().toISOString();

  const lines = [
    `# Fleet Assessment`,
    ``,
    `_Generated ${ts} · window = ${opts.windowHours ?? 24}h_`,
    ``,
    sections.activity(mc),
    ``,
    sections.deliverables(mc),
    ``,
    sections.kpiAlignment(mc),
    ``,
    sections.forecastAccuracy(mc),
    ``,
    sections.kpiMovement(mc),
    ``,
    sections.flags(mc),
    ``,
  ];

  return lines.join("\n");
}

/**
 * Persist the markdown to disk + a timestamped archive. Used by a launchd
 * job that runs every 30 min so the Chief of Staff can read it offline.
 */
export async function snapshotFleetAssessment(
  db: DbExecutor,
  companyId: string,
  opts: FleetAssessmentOptions & { stateDir?: string } = {},
): Promise<{ latestPath: string; archivePath: string }> {
  const { promises: fs } = await import("node:fs");
  const path = (await import("node:path")).default;
  const { homedir } = await import("node:os");
  const stateDir = opts.stateDir ?? path.join(homedir(), ".wavex-os", "state");
  await fs.mkdir(stateDir, { recursive: true });

  const md = await buildFleetAssessment(db, companyId, opts);
  const latestPath = path.join(stateDir, "fleet-assessment-latest.md");
  await fs.writeFile(latestPath, md, "utf8");

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const archivePath = path.join(stateDir, `fleet-assessment-${stamp}.md`);
  await fs.writeFile(archivePath, md, "utf8");

  return { latestPath, archivePath };
}
