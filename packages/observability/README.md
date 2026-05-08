# @wavex-os/observability

Reference implementation of the fleet observability layer described in [`docs/SELF_HEALING.md`](../../docs/SELF_HEALING.md). Field-tested in production for ~7 days; responsible for the 96% drop in 24h imputed fleet burn we measured during the rollout that produced this open-source release.

## What's in here

| Module | Purpose |
|---|---|
| `bottlenecks` | Score KPIs by `gap × staleness × downstreamBlockage`. Top-N feed for Mission Control + the daily digest. |
| `outcome-attribution` | Record per-issue `actualDelta` vs `targetDelta` after close. Per-agent forecast-accuracy rollup. |
| `token-budget` | Imputed-burn computation across 1h/5h/24h/7d windows. Priority-aware throttle ladder for the wakeup gate. |
| `mission-control` | Single-roundtrip aggregator for the dashboard (goal progress + bottlenecks + top burners + spinners). 60s cache. |
| `fleet-observer` | Markdown synthesizer for the Chief of Staff's 4h routine. Pluggable section renderers. |

## Schema dependencies

These services expect the following tables/columns to exist on the database you point them at:

- `company_kpis(company_id, kpi_id, label, direction, target_micros, kpi_owner_agent_id)`
- `kpi_snapshots(company_id, kpi_name, value, measured_at)`
- `cost_events(company_id, agent_id, occurred_at, model, output_tokens, cached_input_tokens, input_tokens)`
- `issues(id, company_id, assignee_agent_id, target_kpi, estimated_delta, baseline_snapshot, created_at, completed_at, status)`
- `task_outcome_attributions(id, issue_id UNIQUE, company_id, kpi_id, assignee_agent_id, baseline_value, baseline_captured_at, target_delta, actual_delta, closing_value, forecast_error, attribution_method, attributed_at)`
- `agents(id, company_id, name, role, reports_to_agent_id)`
- `heartbeat_runs(agent_id, started_at, ended_at, status)`
- `issue_comments(author_agent_id, created_at)`

If you're already running on Paperclip core, all of these exist by default. If not, see the source comments for the precise types each query expects.

## Database adapter

`DbExecutor` is the only DB-shaped dependency. Any driver that exposes a tagged-template `sql` and an `execute<T>` method returning either `T[]` or `{rows: T[]}` will work — Drizzle, postgres.js, kysely with a small wrapper, etc.

The bundled `sql-tag.ts` lazy-loads `drizzle-orm` so this package doesn't hard-depend on it. Call `preloadSqlTag()` once at startup before invoking any DB-bound service:

```ts
import { preloadSqlTag, getMissionControl } from "@wavex-os/observability";
await preloadSqlTag();
const mc = await getMissionControl(db, companyId);
```

If you don't use Drizzle, replace `src/sql-tag.ts` with your own tagged-template helper.

## Customizing for your company

```ts
import {
  setKpiDownstreamBlockages,
  setRoleTiers,
  buildFleetAssessment,
} from "@wavex-os/observability";

// 1. Wire your KPI dependency map (see kpi-deps.example.json):
setKpiDownstreamBlockages({
  data_freshness_seconds: ["*"],
  utm_attribution_coverage: ["conversion_rate", "attributed_revenue"],
});

// 2. (Optional) Override role → criticality tier:
setRoleTiers({
  data_engineer: 2, // tier-up your data team
});

// 3. Wire fleet-observer into your launchd / cron:
const md = await buildFleetAssessment(db, companyId);
```

## What's intentionally excluded

- Anthropic's real per-account quota probe (`anthropic-quota.ts` in Paperclip). It depends on rate-limit-header parsing tied to the Paperclip cost-event ingestion path. Imputed budget is the fallback path; the real probe is a v0.3.0 candidate.
- Hierarchy-walking and KPI-validation triggers. These belong to the orchestrator layer (Paperclip core), not the observability layer.
- LLM-graded fleet assessment. The default renderer is pure-SQL synthesis; if you want LLM-graded sections, pass them in via `buildFleetAssessment({ sections: { forecastAccuracy: yourLlmRenderer } })`.
