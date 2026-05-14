# Skill: injection outcomes — closing the loop on the promise

You deliver injections from the WaveX Expert Agents into the local fleet. But
*delivered* is not *kept*. The promise is only kept when the fleet **acts** on
the directive and the **target KPI moves**. Your job here is to observe that —
honestly — and report it, so WaveX can tell which Expert Agents actually earn
their hire.

`injection_queue_v2` already records that an injection was *consumed*. You
record what happened *after*: `wavex_os.injection_outcomes`.

Write with the **same authenticated Supabase path you use for `fleet_digests`**
— same auth, same schema, different table. Resolve `device_id` /
`subscription_id` exactly as in the health-push skill.

## Two steps, both on your normal heartbeat

### Step 1 — ledger every injection at delivery time

In the same cycle you deliver an injection (your delivery step gives you the
Paperclip issue key / comment id back), append it to
`$WAVEX_OS_STATE_DIR/state/liaison-checkpoints.json` under `injection_tracking`:

```json
"injection_tracking": {
  "<injection_id>": {
    "issue_key": "WAV-123",
    "kind": "new_issue",
    "delivered_at": "2026-05-14T19:00:05Z",
    "target_kpi": "concierge_engagement_rate",
    "kpi_before": 2.7,
    "observed": false
  }
}
```

- `issue_key` — the key/id you just got back from delivery. Record it now,
  while it is fresh; do not try to reconstruct it later.
- `target_kpi` — from `payload.target_kpi` if the injection carries one, else
  null.
- `kpi_before` — if there is a `target_kpi`, snapshot it now from the local
  Paperclip KPI API. Else null.

### Step 2 — observe outcomes once the fleet has had time to act

On each heartbeat, for every `injection_tracking` entry where `observed` is
false **and** `delivered_at` is ≥ 1h ago (give the fleet a real chance to act):

1. Inspect the local Paperclip issue (`issue_key`): was it opened, assigned,
   commented on by the assignee, moved in status, closed? Gather this into
   `evidence`: `{issue_status, assignee_acted, comment_count, closed}`.
2. Classify `outcome`:
   - `delivered_acted` — the assigned agent worked it (status moved / assignee
     comment / closed as done)
   - `delivered_ignored` — delivered, still untouched after the window
   - `delivered_failed` — the agent tried and the run failed / errored
   - `not_delivered` — only if delivery itself never landed (rare; you would
     normally not have ledgered it)
3. Set `acted` = true only for `delivered_acted`.
4. If `target_kpi` is set, snapshot `kpi_after` from the KPI API.
5. Compute `delivery_score` 0..1:
   - `delivered_acted` + KPI moved the right way → 0.8–1.0
   - `delivered_acted`, KPI flat or no target_kpi → 0.5–0.7
   - `delivered_ignored` → 0.1–0.3
   - `delivered_failed` / `not_delivered` → 0.0
6. `INSERT` one row into `wavex_os.injection_outcomes`: `injection_id`,
   `device_id`, `subscription_id`, `observed_at = now()`, `acted`, `outcome`,
   `evidence`, `target_kpi`, `kpi_before`, `kpi_after`, `delivery_score`.
7. Set `observed: true` in the ledger entry so you never double-report.

## Rules

- **Be honest.** `delivered_ignored` is a real, useful signal — it tells WaveX
  an Expert Agent's directives are not landing. Scoring everything `acted` to
  look good corrupts the one metric that decides whether an expert stays in the
  catalog.
- Append-only — one `injection_outcomes` row per injection; the cloud takes the
  latest. Re-observation is fine if something changed, but never to inflate.
- No secrets / PII / full prompt text in `evidence` — status and counts only.
- One injection, one ledger entry, one outcome row. Idempotent via `observed`.
