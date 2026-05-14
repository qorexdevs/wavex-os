# Lovable Agent Prompt — WaveX OS Cloud Console

This is the handoff prompt for the Lovable agent on project
`wavex-experience-architect` (hosts `wavexcard.com`). Paste the section below
the line. Everything it needs is self-contained — it does not have the
`wavex-os` backend repo.

---

## PROMPT FOR THE LOVABLE AGENT

You are completing the **WaveX OS Cloud Console** at `wavexcard.com/os`. The
device-pairing edge functions and `/os` auth entry already exist in this
project — you are building the **console experience that comes after pairing**:
a customer view of their paired instances + hired experts, and an operator
("admin") view that oversees every paying customer's fleet and every WaveX
Expert Agent.

### What WaveX OS is (context you need)

WaveX OS is an open-source runtime that runs an AI agent company on a
customer's own Mac (a local "Paperclip" fleet of ~35 agents). Paying
subscribers additionally hire **WaveX Expert Agents** — server-side agents that
analyze the customer's fleet and inject improvement directives back into it.

The architecture has a hard rule: **the cloud cannot reach a customer's
localhost.** So everything observable flows through **Supabase** (`wavex_os.*`
schema, project `ngvtgraldybxdbgkihfj`). The customer's on-box "Liaison" agent
pushes state **up**; this console reads it. You never connect to a customer
machine directly.

There are two audiences, two surfaces:

- **Customer console** (`/os/console`) — any authenticated subscriber. Their
  instances, their hired experts, their privacy log, their billing.
- **Operator console** (`/os/admin`) — gated by `has_role('admin')`. Every
  paying customer's fleet health, every Expert Agent and the problem it's
  working, open incidents, and the "are the agents doing their job" synthesis.

### Auth & access model

- Supabase Auth is already wired (`/os` entry). Use the existing session.
- Admin gate: a `has_role(uuid, text)` function / `user_roles` table convention
  already used elsewhere in this project — gate `/os/admin` on `admin`.
- **All `wavex_os.*` tables have RLS enabled.** Customers see only their own
  rows; admins see all. Do not bypass RLS. Do not use the service-role key in
  the browser.
- **This console is READ-ONLY against `wavex_os.*`** except for actions that
  already have edge functions (pairing, hire/revoke an expert, revoke a
  device). If you need a new write, call for a new edge function — never write
  to these tables directly from the client.

### Existing Supabase schema you READ (do not create or alter these)

`wavex_os.subscriptions` — `id, user_id, tier('founder'|'growth'|'custom'),
status('trialing'|'active'|'past_due'|'canceled'|...), current_period_end,
cancel_at_period_end, trial_end`. A "paying / Pool B" customer = a row with
`status IN ('trialing','active')`.

`wavex_os.os_devices` — `id, user_id, name, kind('local'|'hosted'),
status('active'|'revoked'), hostname, os_version, last_seen_at`. A customer's
paired instances.

`wavex_os.os_device_pairings` — the pairing handshake (`code, user_code,
status('pending'|'claimed'|'consumed'|'expired'), expires_at`). Pairing UI
already exists; surface pairing *status* on the console.

`wavex_os.expert_agent_catalog` — `id(text), display_name, purpose,
data_scope(text[]), output_types(text[]), required_tier, daily_token_cap,
is_active`. The marketplace of Expert Agents.

`wavex_os.hired_expert_agents` — `id, subscription_id, catalog_id,
status('active'|'paused'|'revoked'), hired_at, revoked_at, agreement_version`.
Which experts a customer has hired.

`wavex_os.injection_queue_v2` — `id, subscription_id, hired_agent_id,
catalog_id, kind, payload(jsonb), issued_at, consumed_at, consumed_by_liaison_id,
expires_at`. **Each row is one directive an Expert Agent produced for a
fleet.** `consumed_at IS NOT NULL` = the customer's Liaison delivered it.
`payload` describes the directive (title, rationale, target).

`wavex_os.digest_access_log` — `id, hired_agent_id, digest_id,
fields_accessed(text[]), purpose, accessed_at`. Every time an Expert Agent
read customer data — this powers the privacy panel.

`wavex_os.usage_ledger` — `id, pool('A'|'C'), subscription_id, device_id,
model, cost_cents, status, ran_at`. Inference spend.

`wavex_os.optimizer_runs` — `id, subscription_id, kind, status('ok'|'error'|
'rate_limited'), injections_generated, ran_at`. Expert Agent run audit.

`wavex_os.fleet_digests` — `id, subscription_id, digest(jsonb), received_at`.
Latest fleet snapshot the customer uploaded.

### NEW tables you BUILD AGAINST (the wavex-os backend team creates them; you
treat them as read-only and may render empty states until populated)

`wavex_os.instance_health` — pushed by the Liaison every ~5 min. One row per
push: `device_id, subscription_id, tier, reported_at, paperclip_reachable(bool),
paperclip_version, agent_count, agents_idle, agents_running, agents_error,
runs_last_hour, runs_failed_last_hour, last_heartbeat_at, recent_errors(jsonb),
fleet_status('healthy'|'degraded'|'down')`. **Always read the latest row per
device** (`DISTINCT ON (device_id) ... ORDER BY device_id, reported_at DESC`).

`wavex_os.fleet_log_synthesis` — pushed every ~6h: `device_id, synthesized_at,
window_hours, runs_total, runs_ok, runs_failed, runs_timeout,
agents_silent(jsonb), effectiveness_score(0..1 numeric), summary(text),
flags(jsonb [{severity, agent_id, note}])`. This is the **"are the agents doing
the right job"** answer — `summary` is a human-readable paragraph.

`wavex_os.injection_outcomes` — pushed after the Liaison observes what the
fleet did with an injection: `injection_id(→injection_queue_v2),
device_id, observed_at, acted(bool), outcome('delivered_acted'|
'delivered_ignored'|'delivered_failed'|'not_delivered'), evidence(jsonb),
target_kpi, kpi_before, kpi_after, delivery_score(0..1 numeric)`. This **closes
the loop on the prompt-injection promise** — it is the difference between "we
sent a directive" and "the directive actually moved the fleet."

### Surface 1 — Customer console `/os/console`

A tabbed or sectioned layout. Sections:

1. **My Instances** — card per `os_devices` row for the current user. Show
   name, hostname, `kind`, `last_seen_at` (relative), and the **latest
   `instance_health`** for that device: a status pill (`healthy` green /
   `degraded` amber / `down` red), agent counts (`agents_running` /
   `agent_count`, `agents_error` if >0), `last_heartbeat_at` relative, and
   `paperclip_version`. If no health row yet → "Waiting for first check-in."
   A revoked device shows greyed with a "Revoked" badge.

2. **My Experts** — card per `hired_expert_agents` row joined to
   `expert_agent_catalog`. Show `display_name`, `purpose`, `status` pill, and
   **what it's working on**: the most recent `injection_queue_v2` rows for that
   `hired_agent_id` — render `payload.title` / `payload.rationale`, with a
   delivered/pending chip from `consumed_at`, and (when available) the
   `injection_outcomes.outcome` + `delivery_score` for that injection. This is
   the customer seeing the promise being kept. Empty state: "This expert is
   analyzing your fleet — first directive lands within one cycle."

3. **Privacy** — table from `digest_access_log` for the current user's hired
   agents: which expert, `fields_accessed`, `purpose`, `accessed_at`. Each
   active expert gets a one-click **Revoke** (call the existing revoke edge
   function; if none exists, request one — do not write the table directly).

4. **Billing & Usage** — `subscriptions` summary (tier, status,
   `current_period_end`, cancel-at-period-end banner) + `usage_ledger` rolled
   up (this period's `cost_cents` by `pool`, run count). Link to the Stripe
   customer portal (existing edge function).

### Surface 2 — Operator console `/os/admin` (admin role only)

This is the operator's oversight cockpit — the "dashboard for me to see the
running Pool B agents and the problems they're tackling."

1. **Fleet Overview** — every paying customer (`subscriptions.status IN
   ('trialing','active')`) with their latest `instance_health` per device.
   **Sort `down` first, then `degraded`, then `healthy`.** Each row: customer
   (subscription tier + masked user identifier), device, status pill, agent
   error count, `last_heartbeat_at`, `recent_errors` expandable. A red counter
   at the top: "N paid fleets need attention." This is the redundancy promise
   made visible — a paid fleet going `down` must be impossible to miss here.

2. **Expert Agents (Pool B work)** — every `hired_expert_agents` across all
   customers joined to `expert_agent_catalog`, grouped by expert type. For
   each: how many customers hired it, recent `injection_queue_v2` volume,
   delivered-rate (`consumed_at` ratio), and **acted-rate + median
   `delivery_score`** from `injection_outcomes`. Drill into one expert → the
   list of directives it issued and, per directive, the `injection_outcomes`
   row: did the customer's fleet act on it, did the `target_kpi` move. This
   answers "are the agents doing the right job, is the promise delivered."

3. **Incidents** — covered incidents the watchdog opened. Until the watchdog
   ships, derive this view from `instance_health` (any paid `fleet_status =
   'down'` or stale `last_heartbeat_at`) + `optimizer_runs` with
   `status='error'`. Each incident: customer, signature, first-seen,
   auto-remediation state, escalation state. Leave room for a future
   `wavex_os.incidents` table — build the component so swapping the data source
   is trivial.

4. **Log Synthesis** — latest `fleet_log_synthesis` per device across all paid
   customers. Render `effectiveness_score` as a gauge, `summary` as the body,
   `flags` as a severity-sorted list, `agents_silent` as a callout. This is the
   operator reading, in plain language, whether each fleet's agents are
   actually doing their jobs.

5. **Admin Instance** — a panel for the WaveX-internal "Mission Control"
   oversight instance (it is itself an `os_devices` row of `kind='hosted'`
   flagged internal — the backend will mark it; for now, treat a device whose
   `name` starts with `WaveX Mission Control` as the admin instance). Show its
   own `instance_health` + `fleet_log_synthesis` so the operator can confirm
   the overseer itself is alive.

### Design system

Match the existing `wavexcard.com` system: dark theme, the accent already in
use, the existing card / pill / table primitives. Status colors: healthy
`#3fb950`-family, degraded amber, down red. Relative timestamps everywhere
(`date-fns` `formatDistanceToNow`). Every list has a real empty state — new
customers will have empty `injection_*` and `*_health` tables for the first
cycle and that must look intentional, not broken. Realtime: subscribe to
`instance_health` and `injection_queue_v2` via Supabase Realtime so the admin
Fleet Overview updates live.

### Hard constraints — do not violate

- **Read-only against `wavex_os.*`.** Writes go through existing edge functions
  (pair, revoke device, revoke expert, Stripe portal). Need a new write? Ask
  for a new edge function; never write these tables from the browser.
- **Do not create or alter `wavex_os.*` tables.** `instance_health`,
  `fleet_log_synthesis`, `injection_outcomes` are owned by the wavex-os backend
  team and will be migrated in by them. Build against the schema above; render
  empty states until the rows arrive.
- **Never put the service-role key in the client.** RLS is the access boundary.
- **Mask customer PII in the admin views** — show subscription tier + a short
  hashed/truncated identifier, not raw emails, unless an admin explicitly
  expands a row.
- **No mock data in shipped components.** If a table is empty, show the empty
  state, not fixtures.

### Definition of done

- `/os/console` renders all 4 customer sections against live Supabase data for
  a signed-in subscriber, with correct RLS scoping.
- `/os/admin` renders all 5 operator sections, gated on the admin role, with
  `down` paid fleets surfaced at the top of Fleet Overview.
- Empty states are intentional and clear for every list.
- Admin Fleet Overview + Expert Agents update via Realtime.
- No service-role key in client code; no direct `wavex_os.*` writes.
