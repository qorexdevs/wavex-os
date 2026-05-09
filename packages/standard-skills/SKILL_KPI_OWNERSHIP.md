# SKILL_KPI_OWNERSHIP — the numbers you defend

**Audience:** any agent registered as a KPI owner in `company_kpis`.

This skill is the meta-pattern. Each KPI owner gets a personalized version that names their KPIs and their data sources. **This document explains the pattern.** It is not itself the KPI list.

## What "KPI owner" means

Your company maintains a `company_kpis` registry with rows like:

```
kpi_name              | direction | target | owner_agent_id | tier | data_source
----------------------+-----------+--------+----------------+------+------------------------
revenue_target_7d     | up        | 25000  | <ceo-id>       | 1    | warehouse:public.orders
qualified_leads_7d    | up        | 50     | <cmo-id>       | 4    | warehouse:public.leads
agent_error_rate      | down      | 5      | <cos-id>       | 5    | paperclip:agent_events
```

If your `agent_id` appears in the `owner_agent_id` column for one or more rows, you are responsible for snapshotting those KPIs every cycle and defending the trend.

## The 5-tier mental model

| Tier | Meaning | Example placeholder |
|---|---|---|
| 1 | **Meta-goal.** The single number that defines success. | `revenue_target_7d` |
| 2 | **Components of meta.** Decompose tier 1 into orthogonal contributors. | `confirmed_orders_7d`, `avg_order_value` |
| 3 | **Conversion drivers.** What pushes tier 2 up. | `order_conversion_rate` |
| 4 | **Top-of-funnel.** What feeds tier 3. | `qualified_leads_7d`, `organic_sessions_7d` |
| 5 | **Health, not gated.** Tracked but not part of the success bar. | `agent_error_rate` |

When you snapshot, do every tier you own — not just tier 1. Lower tiers are how you'll diagnose a tier-1 miss.

## The snapshot loop (per cycle)

1. Run the SQL for every KPI you own against the configured data source.
2. Insert one `kpi_snapshots` row per KPI with `kpi_name`, `value`, `source_query`, `measured_at`.
3. Compute pace against your target (see below).
4. Emit a one-line review report per KPI.

Use the `kpi-snapshot` CLI helper at `<paperclip-root>/tools/kpi-snapshot.mjs --values '<json>'` if your company seeds it. Otherwise insert directly via your DB MCP tool. **Never paste live database credentials into a comment or log.**

## Pace check — are we on track?

```
baseline       = first kpi_snapshots row for this kpi_name (chronologically earliest)
current        = latest kpi_snapshots row
days_elapsed   = (now - baseline.measured_at) in days
days_remaining = window_days - days_elapsed   ; e.g. window_days = 90
required_rate  = (target - current) / max(days_remaining, 1)
observed_rate  = (current - baseline.value) / max(days_elapsed, 1)
```

Status mapping (for an `up`-direction KPI):
- `observed_rate ≥ required_rate * 1.0` → `ON_PACE`
- `0.5 * required_rate ≤ observed_rate < required_rate` → `AT_RISK`
- `observed_rate < 0.5 * required_rate` → `BEHIND`
- Fewer than 2 snapshots → `insufficient-history`

For a `down`-direction KPI (e.g. `agent_error_rate`), invert: `observed_rate` should be the rate of decline; status flips accordingly.

## Reporting line (required, per KPI)

```
KPI <kpi_name>: <current> (baseline <baseline>, Δ <delta>, pace: <ON_PACE|AT_RISK|BEHIND|insufficient-history>)
```

When status is `BEHIND` or `AT_RISK`, add a `BOARD ESCALATION:` line identifying which KPI tier(s) are stalled and which sub-owner (if any) is failing to feed it.

## What you must NOT do

- ❌ Invent KPIs not in `company_kpis`. Register them via approval first.
- ❌ Snapshot only the meta-goal. Lower tiers are the diagnostic.
- ❌ Hardcode credentials anywhere in a skill, comment, or log.
- ❌ Skip a snapshot because "the value didn't change". The cadence IS the signal.

## How KPIs are registered

KPIs are added/changed via the `setup-hierarchy-and-kpis.sample.mjs` script (see `scripts/`) at company setup, or by a board approval that calls the `POST /api/companies/:id/kpis` endpoint at runtime. Owners are assigned to agents based on the org tree (only an agent or a descendant can own a KPI).

If you believe you should own a KPI you don't own — or shouldn't own one you do — file a `request_board_approval` with the proposed change and the reason. Don't reassign yourself.
