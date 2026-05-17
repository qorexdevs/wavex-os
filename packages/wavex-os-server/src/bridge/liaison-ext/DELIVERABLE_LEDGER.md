# Skill: deliverable ledger — accountability + token economics

Every unit of agent work in the local fleet is a **deliverable** with a
contract: `plan_ref → expected_response → assigned_agent → artifacts →
token_cost → status`. You mirror that ledger up to
`wavex_os.deliverable_ledger` so WaveX Mission Control (and the customer's own
console) has **one unified accountability record** — which agent touched which
issue, what they delivered, and what it cost **in tokens**.

You mirror; you do not invent. Status comes from the real issue state.

Write with the **same authenticated Supabase path you use for `fleet_digests`**.
Resolve `device_id` / `subscription_id` as in the health-push skill.

## On each heartbeat

For every issue in the local Paperclip company (`GET /api/companies/:id/issues`,
plus the issue detail for state + comments):

### 1. Read the contract

Ignition (and the handoff) embed a fenced `wavex-contract` block in seeded
issue descriptions:

```
\`\`\`wavex-contract
plan_ref: workflow:<slot>:on_fire
expected_response: <what "done" means>
kind: routine
\`\`\`
```

Parse it out → `plan_ref`, `expected_response`, `kind`. If no block is present
(e.g. an Expert-Agent-issued issue tagged `wavex:expert-issued`, or an operator
issue), leave `plan_ref` / `expected_response` null and infer `kind`:
`wavex:expert-issued` → `directive`, otherwise `routine`.

### 2. Build the row

- `issue_id` — the Paperclip issue key/id.
- `assigned_agent` — the issue's assignee (local slot, or the `source_catalog`
  for an Expert-issued one).
- `contributing_agents` — every agent that commented on or worked the issue,
  as a JSON array.
- `artifacts` — `{comment_ids, commit_shas, pr_url, migration_file}` — whatever
  the issue actually references. Phase 8/9 `code_change` / `db_migration`
  deliverables will carry `pr_url` here.
- `status` — map the Paperclip issue state:
  `open → open`, `in progress / assigned+working → in_progress`,
  `done/closed-success → delivered`, `closed-verified → verified`,
  `failed/errored → failed`.
- `opened_at` / `delivered_at` / `verified_at` — from the issue's status
  history timestamps.

### 3. Attribute tokens (economics in TOKENS, never USD)

- For each heartbeat-run tied to this issue's agent, read the run's token
  counts from the Paperclip run record where available → sum into
  `tokens_in`, `tokens_out`, `tokens_cache`.
- Where Paperclip does not expose per-run token counts, leave them 0 — do not
  guess. Hub-routed inference (Phase 10) is the reliable token source and is
  self-accounting in `usage_ledger`; this best-effort path covers BYO-OAuth
  local runs until then.

### 4. Upsert

`INSERT` into `wavex_os.deliverable_ledger`, upserting on
`(device_id, issue_id)` — one deliverable per issue, updated in place as it
progresses. Set `updated_at = now()` on every write. Include `device_id`,
`subscription_id`, and everything from steps 1–3.

## Rules

- **Mirror, never inflate.** `status` and timestamps come from the actual
  issue. A deliverable marked `delivered` that the issue says is still `open`
  is a lie in the one record the operator trusts for accountability.
- Token counts are real or zero — never estimated to look complete.
- One issue → one deliverable row. Idempotent via the `(device_id, issue_id)`
  upsert; re-running a heartbeat refreshes, never duplicates.
- No secrets / PII in `artifacts` or `expected_response` beyond what is already
  in the issue.
