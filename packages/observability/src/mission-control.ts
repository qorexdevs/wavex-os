/**
 * Aggregator for the Mission Control dashboard. One round-trip returning
 * all widget data. 60s server-side cache to avoid hammering the DB on
 * every page poll.
 */
import type { DbExecutor } from "./types.js";
import { sql } from "./sql-tag.js";
import { computeBottlenecks, type BottleneckRow } from "./bottlenecks.js";

function unwrapRows<T>(result: T[] | { rows: T[] }): T[] {
  return Array.isArray(result) ? result : result.rows;
}

export type GoalProgressRow = {
  kpiId: string;
  label: string;
  direction: string;
  ownerName: string | null;
  currentValue: number | null;
  targetValue: number | null;
  pctOfTarget: number | null;
  delta24h: number | null;
  measuredAt: string | null;
};

export type FleetStat = {
  agentId: string;
  name: string;
  role: string | null;
  burnCents24h: number;
  runs24h: number;
  done24h: number;
  comments24h: number;
};

export type MissionControlResponse = {
  companyId: string;
  computedAt: string;
  goalProgress: GoalProgressRow[];
  bottlenecks: BottleneckRow[];
  fleetTotals: {
    agents: number;
    burnCents24h: number;
    runs24h: number;
    done24h: number;
    comments24h: number;
  };
  topBurners: FleetStat[];
  /** Agents with runs >= 5 AND done = 0 in the last 24h. */
  spinners: FleetStat[];
};

const cache = new Map<string, { at: number; data: MissionControlResponse }>();
const CACHE_TTL_MS = 60_000;

async function computeGoalProgress(
  db: DbExecutor,
  companyId: string,
): Promise<GoalProgressRow[]> {
  const kpis = unwrapRows(
    await db.execute<{
      kpi_id: string;
      label: string;
      direction: string;
      target_micros: string | null;
      owner_name: string | null;
    }>(sql`
      SELECT k.kpi_id, k.label, k.direction, k.target_micros::text, a.name AS owner_name
      FROM company_kpis k
      LEFT JOIN agents a ON a.id = k.kpi_owner_agent_id
      WHERE k.company_id = ${companyId} AND k.kpi_id NOT LIKE '\\_%' ESCAPE '\\'
      ORDER BY k.kpi_id
    `),
  );

  const rows: GoalProgressRow[] = [];
  for (const k of kpis) {
    const latest = unwrapRows(
      await db.execute<{ value: string; measured_at: string }>(sql`
        SELECT value::text, measured_at FROM kpi_snapshots
        WHERE company_id = ${companyId} AND kpi_name = ${k.kpi_id}
        ORDER BY measured_at DESC LIMIT 1
      `),
    );
    const yesterday = unwrapRows(
      await db.execute<{ value: string }>(sql`
        SELECT value::text FROM kpi_snapshots
        WHERE company_id = ${companyId} AND kpi_name = ${k.kpi_id}
          AND measured_at <= NOW() - INTERVAL '24 hours'
        ORDER BY measured_at DESC LIMIT 1
      `),
    );

    const currentValue = latest[0] ? Number(latest[0].value) : null;
    const yesterdayValue = yesterday[0] ? Number(yesterday[0].value) : null;
    const targetValue = k.target_micros != null ? Number(k.target_micros) / 1_000_000 : null;
    const delta24h =
      currentValue != null && yesterdayValue != null ? currentValue - yesterdayValue : null;

    let pctOfTarget: number | null = null;
    if (targetValue != null && currentValue != null && targetValue !== 0) {
      pctOfTarget = (currentValue / targetValue) * 100;
    }

    rows.push({
      kpiId: k.kpi_id,
      label: k.label,
      direction: k.direction,
      ownerName: k.owner_name,
      currentValue,
      targetValue,
      pctOfTarget: pctOfTarget != null ? Math.round(pctOfTarget * 10) / 10 : null,
      delta24h,
      measuredAt: latest[0]?.measured_at ?? null,
    });
  }
  return rows;
}

/**
 * Pull per-agent 24h activity. Adapter-style: takes a function that
 * returns FleetStat[] for the company. The default impl queries
 * `agents` × `heartbeat_runs` × `cost_events` × `comments` directly,
 * but you can swap in a precomputed view.
 */
export type FleetStatsFn = (db: DbExecutor, companyId: string) => Promise<FleetStat[]>;

export const defaultFleetStatsFn: FleetStatsFn = async (db, companyId) => {
  const rows = unwrapRows(
    await db.execute<{
      id: string;
      name: string;
      role: string | null;
      burn_cents_24h: string | null;
      runs_24h: string | null;
      done_24h: string | null;
      comments_24h: string | null;
    }>(sql`
      SELECT
        a.id,
        a.name,
        a.role,
        COALESCE((
          SELECT SUM(
            (output_tokens * 7500.0 + cached_input_tokens * 150.0 + input_tokens * 1500.0) / 1000000.0
          )
          FROM cost_events ce
          WHERE ce.agent_id = a.id AND ce.occurred_at > NOW() - INTERVAL '24 hours'
        ), 0)::text AS burn_cents_24h,
        COALESCE((
          SELECT COUNT(*) FROM heartbeat_runs hr
          WHERE hr.agent_id = a.id AND hr.started_at > NOW() - INTERVAL '24 hours'
        ), 0)::text AS runs_24h,
        COALESCE((
          SELECT COUNT(*) FROM issues i
          WHERE i.assignee_agent_id = a.id AND i.status = 'done'
            AND i.completed_at > NOW() - INTERVAL '24 hours'
        ), 0)::text AS done_24h,
        COALESCE((
          SELECT COUNT(*) FROM issue_comments ic
          WHERE ic.author_agent_id = a.id AND ic.created_at > NOW() - INTERVAL '24 hours'
        ), 0)::text AS comments_24h
      FROM agents a
      WHERE a.company_id = ${companyId}
    `),
  );

  return rows.map((r) => ({
    agentId: r.id,
    name: r.name,
    role: r.role,
    burnCents24h: Math.round(Number(r.burn_cents_24h ?? 0) * 100) / 100,
    runs24h: Number(r.runs_24h ?? 0),
    done24h: Number(r.done_24h ?? 0),
    comments24h: Number(r.comments_24h ?? 0),
  }));
};

export async function getMissionControl(
  db: DbExecutor,
  companyId: string,
  opts: { force?: boolean; fleetStatsFn?: FleetStatsFn } = {},
): Promise<MissionControlResponse> {
  const cached = cache.get(companyId);
  if (!opts.force && cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;

  const fleetStatsFn = opts.fleetStatsFn ?? defaultFleetStatsFn;
  const [goalProgress, bottlenecks, fleetStats] = await Promise.all([
    computeGoalProgress(db, companyId),
    computeBottlenecks(db, companyId, 5),
    fleetStatsFn(db, companyId),
  ]);

  const fleetTotals = {
    agents: fleetStats.length,
    burnCents24h: Math.round(fleetStats.reduce((a, n) => a + n.burnCents24h, 0) * 100) / 100,
    runs24h: fleetStats.reduce((a, n) => a + n.runs24h, 0),
    done24h: fleetStats.reduce((a, n) => a + n.done24h, 0),
    comments24h: fleetStats.reduce((a, n) => a + n.comments24h, 0),
  };

  const topBurners = [...fleetStats].sort((a, b) => b.burnCents24h - a.burnCents24h).slice(0, 5);
  const spinners = fleetStats
    .filter((n) => n.runs24h >= 5 && n.done24h === 0)
    .sort((a, b) => b.burnCents24h - a.burnCents24h)
    .slice(0, 5);

  const data: MissionControlResponse = {
    companyId,
    computedAt: new Date().toISOString(),
    goalProgress,
    bottlenecks,
    fleetTotals,
    topBurners,
    spinners,
  };
  cache.set(companyId, { at: Date.now(), data });
  return data;
}

export function invalidateMissionControlCache(companyId?: string): void {
  if (companyId) cache.delete(companyId);
  else cache.clear();
}
