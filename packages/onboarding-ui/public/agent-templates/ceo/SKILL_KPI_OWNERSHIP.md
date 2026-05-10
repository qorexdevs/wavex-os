# KPI Ownership — the numbers you defend

All KPIs are computed against **Supabase project `<SUPABASE_PROJECT_ID>`** (WaveX Experiences). Use the Supabase MCP tool `mcp__f4f1a4d3-7c3c-46c0-8525-1f4fc8465c6a__execute_sql` with `project_id='<SUPABASE_PROJECT_ID>'`.

Snapshots you write go to the **Paperclip DB** table `kpi_snapshots` (not Supabase).

## Tier 1 (META — the one that matters)

### `booking_gmv`
```sql
SELECT COALESCE(SUM(amount), 0)::NUMERIC AS value
FROM public.bookings
WHERE booking_status IN ('confirmed','completed');
```
- **Target:** ≥ $25,000 within 90 days of your go-live.
- **At go-live baseline:** ~$2,685 across 12 bookings (captured at your first run).
- Every cycle: insert into `kpi_snapshots (kpi_name='booking_gmv', value=<result>, source_query=<SQL>)`.

## Tier 2 (components of meta)

### `confirmed_bookings_count`
```sql
SELECT COUNT(*)::NUMERIC AS value
FROM public.bookings
WHERE booking_status IN ('confirmed','completed');
```

### `avg_order_value`
```sql
SELECT COALESCE(AVG(amount), 0)::NUMERIC AS value
FROM public.bookings
WHERE booking_status IN ('confirmed','completed');
```

## Tier 3 (conversion drivers)

### `booking_conversion_rate`
```sql
SELECT CASE WHEN COUNT(*) = 0 THEN 0
  ELSE ROUND(100.0 * SUM(CASE WHEN booking_status IN ('confirmed','completed') THEN 1 ELSE 0 END)::NUMERIC / COUNT(*)::NUMERIC, 2)
  END AS value
FROM public.bookings;
```

### `genesis_card_sales`
```sql
SELECT COUNT(*)::NUMERIC AS value
FROM public.genesis_leads
WHERE status = 'converted' OR status = 'purchased';
```
(If the `status` column or values differ, probe with `SELECT DISTINCT status FROM genesis_leads LIMIT 20` and adapt.)

## Tier 4 (top-of-funnel, CMO lane)

### `marketing_events_7d`
```sql
SELECT COUNT(*)::NUMERIC AS value
FROM public.marketing_events
WHERE created_at >= NOW() - INTERVAL '7 days';
```

### `new_auth_users_7d`
**IMPORTANT (updated 2026-04-24 after CMO diagnosis):** filter out anonymous Supabase sessions. Prior definition was counting `signInAnonymously()` ephemeral sessions as new users, causing the "211→2/week collapse" false alarm. Real registered-user baseline has never exceeded 16/week.

```sql
SELECT COUNT(*)::NUMERIC AS value
FROM auth.users
WHERE created_at >= NOW() - INTERVAL '7 days'
  AND (is_anonymous = false OR is_anonymous IS NULL);
```

### `concierge_engagement_rate`
```sql
SELECT CASE WHEN (SELECT COUNT(*) FROM auth.users) = 0 THEN 0
  ELSE ROUND(100.0 *
    (SELECT COUNT(DISTINCT user_id) FROM public.concierge_messages
     WHERE created_at >= NOW() - INTERVAL '30 days')::NUMERIC
    / (SELECT COUNT(*) FROM auth.users)::NUMERIC, 2)
  END AS value;
```

## Tier 5 (health, not gated)

### `agent_error_rate`
```sql
SELECT CASE WHEN COUNT(*) = 0 THEN 0
  ELSE ROUND(100.0 * SUM(CASE WHEN severity = 'error' THEN 1 ELSE 0 END)::NUMERIC / COUNT(*)::NUMERIC, 2)
  END AS value
FROM public.agent_events
WHERE created_at >= NOW() - INTERVAL '7 days';
```

---

## How to insert snapshots — USE THE A5 TOOL

**Do NOT write `INSERT INTO kpi_snapshots` queries inline.** That pattern is brittle (password rotation, schema drift, 11 separate Bash calls per cycle). Use the dedicated tool.

**Tool:** `$INSTANCE_DIR/tools/kpi-snapshot.mjs`

**Per-cycle workflow:**

1. Run the SQL for every KPI in tiers 1–5 via the Supabase MCP tool `mcp__f4f1a4d3-7c3c-46c0-8525-1f4fc8465c6a__execute_sql` with `project_id='<SUPABASE_PROJECT_ID>'`. Collect the numeric results into a single object.

2. Pipe that object into the tool in ONE Bash call:

```bash
node $INSTANCE_DIR/tools/kpi-snapshot.mjs --values '{
  "booking_gmv": 2494.52,
  "confirmed_bookings_count": 11,
  "avg_order_value": 226.77,
  "booking_conversion_rate": 91.67,
  "genesis_card_sales": 4,
  "marketing_events_7d": 1204,
  "new_auth_users_7d": 2,
  "concierge_engagement_rate": 2.76,
  "agent_error_rate": 5.45
}'
```

3. The tool writes every value to `kpi_snapshots`, computes pace against the meta-goal, and returns a single JSON object. Include the tool's `pace` block verbatim in your review report. If `errors[]` is non-empty, flag each failure in `Blockers:`.

**Pace-only mode** (when you don't need to write snapshots — e.g. mid-cycle pace check):

```bash
node $INSTANCE_DIR/tools/kpi-snapshot.mjs --pace-only
```

**Dry-run mode** (validate values without writing):

```bash
node .../tools/kpi-snapshot.mjs --dry-run --values '{...}'
```

## Pace interpretation

The tool returns `pace.status` — one of `ON_PACE`, `AT_RISK`, `BEHIND`, `insufficient-history`. Use that literal status in your report line:

```
Meta-goal: booking_gmv = $<current> (baseline $<baseline>, +$<delta>, pace: <status>)
```

When status is `BEHIND` OR `AT_RISK`, add a `BOARD ESCALATION:` line identifying which KPI tier(s) are stalled and which operator owns them.

---

## Pace check — are we on track?

After snapshotting `booking_gmv`, compute pace:
```
baseline = first booking_gmv snapshot (chronologically earliest in kpi_snapshots for kpi_name='booking_gmv')
current  = latest booking_gmv snapshot
days_elapsed = (now - baseline.measured_at) in days
days_remaining = 90 - days_elapsed
required_rate = ($25,000 - current) / days_remaining
observed_rate = (current - baseline.value) / days_elapsed
```

If `observed_rate < required_rate * 0.5`, emit **BEHIND** in the review report. If between 0.5× and 1×, **AT RISK**. If ≥ 1×, **ON PACE**.
