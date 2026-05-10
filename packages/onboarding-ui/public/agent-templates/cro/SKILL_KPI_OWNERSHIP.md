# SKILL_KPI_OWNERSHIP — you own these KPIs and are accountable for moving them

**Effective:** 2026-05-04
**Audience:** any agent listed as `kpi_owner_agent_id` on one or more rows in `company_kpis`.
**Source:** Phase 3 of the accountability roadmap (`$HOME/.claude/plans/precious-napping-globe.md`).

## Why this exists

Until now, KPIs in `kpi_snapshots` had targets in spirit but no formal ownership. Phase 3 registered every business KPI in `company_kpis` and assigned an owner. If `kpi_owner_agent_id = your-agent-id`, you are the accountable agent for that KPI's progress to target.

Read this skill at the start of every cycle and after any board directive that touches your KPIs.

## What "owning a KPI" means in this org

1. **You declare the bottleneck** — once per cycle (and on board request), you must produce a comment on a board-tracked issue naming the **top-3 bottlenecks** among your KPIs, ranked by `gap × staleness × downstream_blockage`. The maintenance service publishes these scores via `GET /api/companies/:id/bottlenecks` (Phase 4); use that as your input.

2. **Every closed task on your tree must be attributable to one of your KPIs.** When a task assigned within your reports_to subtree closes, its `target_kpi` should be one of yours. If it isn't, that's a sign of work that doesn't deliver to your accountability. Either reassign in advance or kill the task.

3. **No KPI movement for 5 days = mandatory escalation.** If your KPI's aggregated `actual_delta` over a rolling 5-day window is 0 (no movement), file a `request_board_approval` naming the structural blocker and what change you need from the board. Silent stagnation is the largest symptom of a misaligned org and is not allowed.

4. **Forecast accuracy is your scorecard.** Phase 2's `task_outcome_attributions` records `target_delta` (your estimate) vs `actual_delta` (what happened). Your rolling 7d / 30d forecast accuracy is surfaced in `CURRENT_ECONOMICS.md`. Persistent over-estimation (>3× factor) means you are committing to work that doesn't deliver — recalibrate.

## Your KPIs (read your CURRENT_ECONOMICS.md for the live list)

Each cycle you own a subset of `company_kpis` rows. Read your `agents/<your-id>/instructions/CURRENT_ECONOMICS.md` to see the current list (refreshed every 15 min by `maintenance/refresh-agent-economics`). The format:

```
## Owned KPIs (from company_kpis.kpi_owner_agent_id)
- new_auth_users_7d  current=0  target=30  gap=-30  direction=higher_is_better
- marketing_events_7d  current=1196  target=null  gap=null  direction=higher_is_better
...
```

If a KPI has `target=null`, file a `request_board_approval` to set the target before the next cycle. KPIs without targets cannot be measured against, and the bottleneck detector cannot rank them.

## Accountability cadence

- **Daily** (every wake): if your top KPI by gap has had no `kpi_snapshot` entry in the last 24h, that is itself a bottleneck — the data isn't refreshing. File a comment to the CDO/Telemetry agent's tree to investigate (or to the engineer team if the source query is broken).
- **Cycle start** (Mondays for the <ISSUE-N> cadence): produce your top-3 bottlenecks comment on the cycle's master directive issue.
- **Cycle mid-point**: ratify or kill each open task on your tree against your KPIs. Tasks that have moved 0 toward their target by mid-point are kill candidates.
- **Cycle end**: post a closing comment on the cycle directive: per-KPI (target | actual | delta), per-task forecast accuracy, what you'd change next cycle.

## Hierarchy contract

You report to your `reports_to` agent. Read `chainOfCommand` from `GET /api/agents/me` to see your full upward chain. Two rules:

- **No cross-tree assignment without owner consent.** If you assign a task whose `target_kpi` is owned by an agent NOT in your reports_to subtree, the validator (Phase 1) will log/reject (`assignee_not_in_owner_tree` violation). Reassign to someone in the owner's tree, or convince the owner to take it.
- **Escalate, don't go around.** If your manager's decisions block your KPI work, escalate up the chain via `request_board_approval`. Never reassign your manager's tasks to yourself.

## Closing line for KPI-owner heartbeats (required)

Every heartbeat where you take action on a KPI you own must end with:

```
KPI_DELTA: <kpi_id>=<actual_delta_this_heartbeat or "no_op_in_window">
NEXT: <next concrete action with date>
```

Example:
```
KPI_DELTA: new_auth_users_7d=<value> (no movement; baseline 0, target 30; bottleneck = utm_attribution_coverage)
NEXT: spawning child issue for CDO/Attribute to ship UTM capture form by 2026-05-06
```

If your heartbeat's KPI_DELTA is "no_op_in_window" 5 days running, file the escalation per accountability rule 3 above.

## What this skill does NOT mean

- Owning a KPI does NOT mean you must do the work yourself. You can (and should) delegate to your reports.
- Owning a KPI does NOT mean you control the data source. If `kpi_freshness_seconds` is large for your KPI, that's a CDO/Telemetry issue — escalate, don't try to patch the data pipeline yourself.
- Owning a KPI does NOT make you immune to forecast-accuracy review. You are still accountable for the quality of `estimated_delta` on every issue you create against the KPI.
