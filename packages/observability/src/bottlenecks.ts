/**
 * Score a company's KPIs by gap × staleness × downstream blockage.
 * Higher score = bigger bottleneck. Used by Mission Control's bottleneck
 * widget and the daily digest.
 *
 * Formula:
 *   gap                = (target - current) / target  (signed by direction)
 *   staleness_days     = days since the snapshot value last changed
 *   downstream_blockage = #other KPIs blocked by this one
 *   score = max(0, gap_normalized) × (1 + staleness_days/7) × (1 + downstream_blockage)
 */
import type { DbExecutor } from "./types.js";
import { sql } from "./sql-tag.js";

/**
 * KPI dependency map — "if X is broken, these KPIs cannot be measured reliably".
 *
 * Default is empty; wire in your company's dependencies via `setKpiDownstreamBlockages`.
 * A "*" wildcard means the KPI blocks every other KPI (e.g. `kpi_freshness_seconds`).
 *
 * See `kpi-deps.example.json` for a generic example map.
 */
let KPI_DOWNSTREAM_BLOCKAGES: Record<string, string[]> = {};

export function setKpiDownstreamBlockages(map: Record<string, string[]>): void {
  KPI_DOWNSTREAM_BLOCKAGES = map;
}

function downstreamCount(kpiId: string, allKpis: string[]): number {
  const blocked = KPI_DOWNSTREAM_BLOCKAGES[kpiId];
  if (!blocked) return 0;
  if (blocked.includes("*")) return allKpis.length - 1;
  return blocked.length;
}

export type BottleneckRow = {
  kpiId: string;
  label: string;
  direction: string;
  ownerAgentId: string | null;
  ownerName: string | null;
  currentValue: number | null;
  targetValue: number | null;
  gap: number | null;
  gapNormalized: number;
  stalenessDays: number;
  downstreamBlockage: number;
  blockedKpis: string[];
  score: number;
  measuredAt: string | null;
  recentMovementAt: string | null;
};

type RawKpi = {
  kpi_id: string;
  label: string;
  direction: string;
  target_micros: string | null;
  kpi_owner_agent_id: string | null;
  owner_name: string | null;
};

function unwrapRows<T>(result: T[] | { rows: T[] }): T[] {
  return Array.isArray(result) ? result : result.rows;
}

export async function computeBottlenecks(
  db: DbExecutor,
  companyId: string,
  limit = 10,
): Promise<BottleneckRow[]> {
  const kpis = unwrapRows(
    await db.execute<RawKpi>(sql`
      SELECT k.kpi_id, k.label, k.direction, k.target_micros::text, k.kpi_owner_agent_id, a.name AS owner_name
      FROM company_kpis k
      LEFT JOIN agents a ON a.id = k.kpi_owner_agent_id
      WHERE k.company_id = ${companyId} AND k.kpi_id NOT LIKE '\\_%' ESCAPE '\\'
    `),
  );

  const allKpiIds = kpis.map((k) => k.kpi_id);
  const rows: BottleneckRow[] = [];

  for (const k of kpis) {
    const latest = unwrapRows(
      await db.execute<{ value: string; measured_at: string }>(sql`
        SELECT value::text, measured_at FROM kpi_snapshots
        WHERE company_id = ${companyId} AND kpi_name = ${k.kpi_id}
        ORDER BY measured_at DESC LIMIT 1
      `),
    );
    const currentValue = latest[0] ? Number(latest[0].value) : null;
    const measuredAt = latest[0]?.measured_at ?? null;

    // Most recent snapshot whose value differs from latest = "movement"
    const moved = unwrapRows(
      await db.execute<{ measured_at: string }>(sql`
        SELECT measured_at FROM kpi_snapshots
        WHERE company_id = ${companyId} AND kpi_name = ${k.kpi_id}
          AND value::text <> ${latest[0]?.value ?? null}
        ORDER BY measured_at DESC LIMIT 1
      `),
    );
    const recentMovementAt = moved[0]?.measured_at ?? null;
    const stalenessDays = recentMovementAt
      ? (Date.now() - new Date(recentMovementAt).getTime()) / (1000 * 60 * 60 * 24)
      : 30;

    const targetValue = k.target_micros != null ? Number(k.target_micros) / 1_000_000 : null;
    let gap: number | null = null;
    let gapNormalized = 0;
    if (targetValue != null && currentValue != null && targetValue !== 0) {
      const rawGap = targetValue - currentValue;
      gap = k.direction === "lower_is_better" ? -rawGap : rawGap;
      gapNormalized = Math.max(0, gap / Math.abs(targetValue));
    } else if (targetValue == null && currentValue == 0) {
      gap = null;
      gapNormalized = 1.0;
    }

    const downstreamBlockage = downstreamCount(k.kpi_id, allKpiIds);
    const blockedKpis = KPI_DOWNSTREAM_BLOCKAGES[k.kpi_id]?.includes("*")
      ? allKpiIds.filter((x) => x !== k.kpi_id)
      : (KPI_DOWNSTREAM_BLOCKAGES[k.kpi_id] ?? []);

    const score = gapNormalized * (1 + stalenessDays / 7) * (1 + downstreamBlockage);

    rows.push({
      kpiId: k.kpi_id,
      label: k.label,
      direction: k.direction,
      ownerAgentId: k.kpi_owner_agent_id,
      ownerName: k.owner_name,
      currentValue,
      targetValue,
      gap,
      gapNormalized: Math.round(gapNormalized * 1000) / 1000,
      stalenessDays: Math.round(stalenessDays * 10) / 10,
      downstreamBlockage,
      blockedKpis,
      score: Math.round(score * 1000) / 1000,
      measuredAt,
      recentMovementAt,
    });
  }

  rows.sort((a, b) => b.score - a.score);
  return rows.slice(0, limit);
}

/**
 * Compose a digest message (markdown-light) summarizing the top
 * bottlenecks. Pure function — caller dispatches to whatever transport.
 */
export function renderBottleneckDigest(
  rows: BottleneckRow[],
  opts: { dashboardUrl?: string | null } = {},
): string {
  const lines = [`📊 *Top bottlenecks (auto-detected)*`];
  for (const [i, r] of rows.slice(0, 5).entries()) {
    const owner = r.ownerName ?? "(unowned)";
    const gapStr =
      r.targetValue != null && r.currentValue != null
        ? `${r.currentValue} → ${r.targetValue} (gap=${(r.gapNormalized * 100).toFixed(0)}%)`
        : `current=${r.currentValue ?? "?"} (no target)`;
    lines.push(
      `\n${i + 1}. *${r.label}* — ${gapStr}` +
        `\n   owner: ${owner} · stale: ${r.stalenessDays}d · blocks: ${r.downstreamBlockage} other KPI${r.downstreamBlockage === 1 ? "" : "s"}` +
        `\n   score: ${r.score}`,
    );
  }
  if (opts.dashboardUrl) {
    lines.push(`\n\nMission Control: ${opts.dashboardUrl.replace(/\/$/, "")}`);
  }
  return lines.join("\n");
}
