# KPI Ownership — System Reliability tier

You own three KPIs. They are not negotiable. Every heartbeat snapshots all three; every comment you make on a related issue must include the current value of the one(s) you're acting on.

## Tier (your tier)

### `host_disk_used_pct`

```bash
df / | tail -1 | awk '{print +$5}'
```

- **Target:** `< 70%` (steady state). Treat anything above 80% as an active incident.
- **Direction:** lower is better.
- **Baseline:** captured at your first run; written to `kpi_snapshots`.
- **Failure mode if you don't watch this:** Postgres `mdzeroextend` errors → mid-transaction agent runs corrupt → cascade into the `target_kpi` plugin's failure-loop trap (see `SKILL_KERNEL_LESSONS.md` L3 + `SKILL_RECOVERY_DOOM_LOOP_GUARD.md`).

### `host_ram_pressure_mbps`

Use `vm_stat` polled twice 1 second apart; the swap delta is your number.

```bash
~/.wavex-os/tools/host-metrics.mjs --metric=ram_pressure
```

- **Target:** `< 10 MB/s` (steady state). Treat sustained `> 50 MB/s` as an incident.
- **Direction:** lower is better.
- **Baseline:** captured at your first run.
- **Failure mode if you don't watch this:** agent spawn latency jumps from seconds to minutes; the fleet appears stuck while actually paging. CEO + CoS lose ability to course-correct in real time.

### `inference_daily_burn_pct`

```sql
SELECT
  ROUND(100.0 * SUM(cost_cents) / NULLIF((SELECT daily_cap_cents FROM wavex_os.platform_config WHERE key='daily_inference_cap'), 0), 1) AS value
FROM wavex_os.optimizer_runs
WHERE ran_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC');
```

- **Target:** `< 60%` daily steady-state. Treat `≥ 85%` as an active throttle event.
- **Direction:** lower is better.
- **Baseline:** captured at your first run.
- **Failure mode if you don't watch this:** Anthropic 429 storms during demos; Pool A onboarding burst exhausts the daily cap and onboarding fails over to T1 deterministic fallback (which is a degraded UX, not a fault).

## Measurement contract

Every issue you create or accept MUST satisfy the four-field contract from `SKILL_KPI_OWNERSHIP.md` (universal):

- `target_kpi`: one of the three above.
- `estimated_delta`: signed numeric. For cleanup actions, this is the percentage points you expect disk to drop.
- `measurement_plan`: the exact `df` / `vm_stat` / SQL query that will read the post-action value.
- `baseline_snapshot`: `{value, measured_at, note}` capturing pre-action state.

The CoS grades your issues on this contract like any other agent. Missing fields → auto-F.

## Structural-zero check

When `host_ram_pressure_mbps` reads `0`, you must distinguish:

- **Measured zero:** vm_stat returned successfully and no swap activity occurred → green.
- **Structural zero:** `vm_stat` failed or the tool errored → unknown.

The `host-metrics.mjs` tool returns `null` not `0` for structural zeros. If you receive `null`, file a `[BLOCKED]` issue with `### BLOCKED — host-metrics returned null` and do NOT treat the metric as green.

## What you do NOT own

- Per-agent inference burn (CFO + Economic Self-Awareness skills handle that).
- Per-issue forecast accuracy (CoS owns).
- The Anthropic 5-hour rolling window itself (Pool B is the customer's Max plan; you only see the wavex_os.optimizer_runs ledger which is Pool A + Pool C).

If you observe disk/RAM/inference problems caused by a SPECIFIC agent's behavior (e.g. a spinner with 30 runs and 1 done), call `POST /api/maintenance/auto-pause-spinners` and file an issue routing the diagnosis to CoS. Don't try to fix the offending agent yourself — your lane is host-level, not agent-level.
