/**
 * Records (or upserts) a task_outcome_attributions row for a closed issue.
 * Idempotent — the unique index on issue_id means re-runs upsert.
 *
 * Algorithm (snapshot_diff):
 *   - baseline      = baseline_snapshot.value (preferred) OR latest
 *                     kpi_snapshot before issue.created_at (fallback).
 *   - closing       = latest kpi_snapshot before issue.completed_at.
 *   - actualDelta   = closing - baseline.
 *   - forecastError = targetDelta - actualDelta.
 *
 * Fail-soft: returns `{ ok: false, reason }` on any error (logged, never thrown).
 */
import type { DbExecutor } from "./types.js";
import { sql } from "./sql-tag.js";

function unwrapRows<T>(result: T[] | { rows: T[] }): T[] {
  return Array.isArray(result) ? result : result.rows;
}

export type AttributionResult =
  | {
      ok: true;
      attribution: {
        baselineValue: number | null;
        closingValue: number | null;
        targetDelta: number | null;
        actualDelta: number | null;
        forecastError: number | null;
      };
    }
  | { ok: false; reason: string };

export async function recordOutcomeAttribution(
  db: DbExecutor,
  issueId: string,
): Promise<AttributionResult> {
  try {
    const issueRows = unwrapRows(
      await db.execute<{
        id: string;
        company_id: string;
        assignee_agent_id: string | null;
        target_kpi: string | null;
        estimated_delta: string | null;
        baseline_snapshot: { value?: number; measuredAt?: string } | null;
        created_at: string | Date;
        completed_at: string | Date | null;
        status: string;
      }>(sql`
        SELECT id, company_id, assignee_agent_id, target_kpi, estimated_delta::text,
               baseline_snapshot, created_at, completed_at, status
        FROM issues WHERE id = ${issueId} LIMIT 1
      `),
    );

    const issue = issueRows[0];
    if (!issue) return { ok: false, reason: "issue_not_found" };
    if (issue.status !== "done") return { ok: false, reason: "issue_not_done" };
    if (!issue.target_kpi) return { ok: false, reason: "no_target_kpi" };

    const createdAt =
      issue.created_at instanceof Date ? issue.created_at : new Date(issue.created_at);
    const completedAt =
      issue.completed_at instanceof Date
        ? issue.completed_at
        : issue.completed_at
          ? new Date(issue.completed_at)
          : null;
    const closedAt = completedAt ?? new Date();

    let baselineValue: number | null = null;
    let baselineCapturedAt: Date | null = null;
    if (issue.baseline_snapshot && typeof issue.baseline_snapshot.value === "number") {
      baselineValue = issue.baseline_snapshot.value;
      baselineCapturedAt = issue.baseline_snapshot.measuredAt
        ? new Date(issue.baseline_snapshot.measuredAt)
        : createdAt;
    } else {
      const baselineRows = unwrapRows(
        await db.execute<{ value: string; measured_at: string }>(sql`
          SELECT value::text, measured_at FROM kpi_snapshots
          WHERE company_id = ${issue.company_id} AND kpi_name = ${issue.target_kpi}
            AND measured_at <= ${createdAt.toISOString()}
          ORDER BY measured_at DESC LIMIT 1
        `),
      );
      if (baselineRows[0]) {
        baselineValue = Number(baselineRows[0].value);
        baselineCapturedAt = new Date(baselineRows[0].measured_at);
      }
    }

    const closingRows = unwrapRows(
      await db.execute<{ value: string; measured_at: string }>(sql`
        SELECT value::text, measured_at FROM kpi_snapshots
        WHERE company_id = ${issue.company_id} AND kpi_name = ${issue.target_kpi}
          AND measured_at <= ${closedAt.toISOString()}
        ORDER BY measured_at DESC LIMIT 1
      `),
    );
    const closingValue = closingRows[0] ? Number(closingRows[0].value) : null;

    const targetDelta = issue.estimated_delta != null ? Number(issue.estimated_delta) : null;
    const actualDelta =
      baselineValue != null && closingValue != null ? closingValue - baselineValue : null;
    const forecastError =
      targetDelta != null && actualDelta != null ? targetDelta - actualDelta : null;

    await db.execute(sql`
      INSERT INTO task_outcome_attributions
        (issue_id, company_id, kpi_id, assignee_agent_id,
         baseline_value, baseline_captured_at, target_delta, actual_delta,
         closing_value, forecast_error, attribution_method)
      VALUES
        (${issue.id}, ${issue.company_id}, ${issue.target_kpi}, ${issue.assignee_agent_id ?? null},
         ${baselineValue}, ${baselineCapturedAt ? baselineCapturedAt.toISOString() : null},
         ${targetDelta}, ${actualDelta}, ${closingValue}, ${forecastError},
         'snapshot_diff')
      ON CONFLICT (issue_id) DO UPDATE SET
        baseline_value = EXCLUDED.baseline_value,
        baseline_captured_at = EXCLUDED.baseline_captured_at,
        target_delta = EXCLUDED.target_delta,
        actual_delta = EXCLUDED.actual_delta,
        closing_value = EXCLUDED.closing_value,
        forecast_error = EXCLUDED.forecast_error,
        attributed_at = now()
    `);

    return {
      ok: true,
      attribution: { baselineValue, closingValue, targetDelta, actualDelta, forecastError },
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[outcome-attribution] recordOutcomeAttribution failed", err);
    return { ok: false, reason: "internal_error" };
  }
}

/**
 * Backfill attributions for any issue that's done + has a target_kpi but
 * has no row in task_outcome_attributions yet. Used by an hourly sweep.
 */
export async function runAttributionSweep(
  db: DbExecutor,
  companyId: string,
  limit = 200,
): Promise<{ scanned: number; attributed: number; skipped: number }> {
  const rows = unwrapRows(
    await db.execute<{ id: string }>(sql`
      SELECT i.id FROM issues i
      LEFT JOIN task_outcome_attributions toa ON toa.issue_id = i.id
      WHERE i.company_id = ${companyId}
        AND i.status = 'done'
        AND i.completed_at > NOW() - INTERVAL '7 days'
        AND i.target_kpi IS NOT NULL
        AND toa.id IS NULL
      ORDER BY i.completed_at DESC
      LIMIT ${limit}
    `),
  );

  let attributed = 0;
  let skipped = 0;
  for (const row of rows) {
    const result = await recordOutcomeAttribution(db, row.id);
    if (result.ok) attributed++;
    else skipped++;
  }
  return { scanned: rows.length, attributed, skipped };
}

export type ForecastAccuracyResult = {
  agentId: string;
  windowDays: number;
  tasksAttributed: number;
  meanForecastError: number | null;
  signedBias: number | null;
  /** 1 - mean(|forecastError| / |targetDelta|), clipped [0,1]. Null if no attributions in window. */
  accuracyScore: number | null;
};

export async function getAgentForecastAccuracy(
  db: DbExecutor,
  agentId: string,
  windowDays = 7,
): Promise<ForecastAccuracyResult> {
  const rows = unwrapRows(
    await db.execute<{
      n: number;
      mean_abs_error: string | null;
      signed_bias: string | null;
      mean_relative_error: string | null;
    }>(sql`
      SELECT
        COUNT(*)::int AS n,
        AVG(ABS(forecast_error))::text AS mean_abs_error,
        AVG(forecast_error)::text AS signed_bias,
        AVG(CASE WHEN target_delta IS NULL OR target_delta = 0 THEN NULL
                 ELSE ABS(forecast_error) / ABS(target_delta) END)::text AS mean_relative_error
      FROM task_outcome_attributions
      WHERE assignee_agent_id = ${agentId}
        AND attributed_at > NOW() - (${windowDays}::int || ' days')::interval
        AND forecast_error IS NOT NULL
    `),
  );
  const r = rows[0];
  const n = Number(r?.n ?? 0);
  if (n === 0) {
    return {
      agentId,
      windowDays,
      tasksAttributed: 0,
      meanForecastError: null,
      signedBias: null,
      accuracyScore: null,
    };
  }
  const meanAbs = r?.mean_abs_error != null ? Number(r.mean_abs_error) : null;
  const signedBias = r?.signed_bias != null ? Number(r.signed_bias) : null;
  const meanRel = r?.mean_relative_error != null ? Number(r.mean_relative_error) : null;
  const accuracyScore = meanRel != null ? Math.max(0, Math.min(1, 1 - meanRel)) : null;
  return {
    agentId,
    windowDays,
    tasksAttributed: n,
    meanForecastError: meanAbs,
    signedBias,
    accuracyScore,
  };
}
