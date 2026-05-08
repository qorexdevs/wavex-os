/**
 * Minimal database executor interface that this package depends on.
 *
 * Any DB driver that exposes a tagged-template `sql` function (Drizzle,
 * postgres.js, etc.) and an `execute<T>` method returning typed rows can
 * satisfy this. The reference implementation in `@paperclipai/db` already
 * does. To use these services with a different DB layer, write an adapter
 * that wraps your driver in this shape.
 *
 * Schema dependencies (must exist on the target DB):
 *   - company_kpis(company_id, kpi_id, label, direction, target_micros, kpi_owner_agent_id)
 *   - kpi_snapshots(company_id, kpi_name, value, measured_at)
 *   - cost_events(company_id, occurred_at, model, output_tokens, cached_input_tokens, input_tokens)
 *   - issues(id, company_id, assignee_agent_id, target_kpi, estimated_delta, baseline_snapshot, created_at, completed_at, status)
 *   - task_outcome_attributions(id UNIQUE issue_id, company_id, kpi_id, assignee_agent_id, baseline_value, baseline_captured_at, target_delta, actual_delta, closing_value, forecast_error, attribution_method, attributed_at)
 *   - agents(id, name, role, tier, reports_to_agent_id)
 *   - heartbeat_runs(agent_id, started_at, ended_at, status)  (optional — used by mission-control)
 *
 * See packages/observability/README.md for the SQL DDL of these tables.
 */
export type DbExecutor = {
  execute<T = unknown>(query: unknown): Promise<T[] | { rows: T[] }>;
};

/** Re-exported tagged-template type marker so callers can pass `sql\`…\``. */
export type SqlTag = unknown;
