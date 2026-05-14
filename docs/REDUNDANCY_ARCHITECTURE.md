# Redundancy & Observability — "the paid subscriber always has their back covered"

**Status:** design — agreed scope, phased build pending operator go-ahead.
**Origin:** 2026-05-14. A P0 auth bug (`CLAUDE_CONFIG_DIR` poisoning, see
`PAPERCLIP_AUTH_FIX.md`) silently took down a paying customer's fleet during a
live demo and nobody knew until the customer hit it. This must never recur
silently for a paid subscriber.

## The hard constraint that shapes everything

**WaveX cloud cannot reach a customer's localhost Paperclip.** Their fleet runs
on their Mac, port 3100, not internet-routable. So "redundancy" is **not** "we
SSH in and fix it." It is:

1. the customer's **Liaison** (already running on their box) pushes health +
   log-synthesis **up** to Supabase, and
2. a **watchdog** reads Supabase, detects trouble, and either (a) emits a signed
   remediation instruction the Liaison applies locally, or (b) escalates to the
   operator.

Supabase is the **single cloud-reachable source of truth**. Everything —
watchdog, operator dashboard, the Lovable console — reads it.

```
 customer's Mac                          WaveX cloud (Supabase wavex_os.*)
 ┌─────────────────────────┐             ┌──────────────────────────────┐
 │ Paperclip fleet :3100   │             │ instance_health              │
 │  35 agents              │   push ▲    │ fleet_log_synthesis          │
 │                         │   every│    │ injection_outcomes           │
 │ Liaison ────────────────┼────────┴───▶│ injection_queue_v2 (existing)│
 │  - reads Paperclip API  │            │ hired_expert_agents (existing)│
 │  - synthesizes logs     │◀───────────┤ subscriptions       (existing)│
 │  - applies remediations │  pull      └──────────────┬───────────────┘
 └─────────────────────────┘  signed                   │ read
                              instructions    ┌────────┴────────┐
                                               │                │
                                       watchdog (ops-cycle)   operator dashboard
                                       + admin instance       (cloud console)
```

## New data model (Supabase `wavex_os.*`)

Three new tables. Owned by the wavex-os backend (migrations live in this repo);
the Lovable console builds **read-only** against them.

### `wavex_os.instance_health`
Pushed by the Liaison every ~5 min (paid) / ~30 min (free). One row per push.

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `device_id` | uuid | FK to the paired device |
| `subscription_id` | uuid | FK `subscriptions`; null for free |
| `tier` | text | `pool_b` (paid) / `pool_a` (free) |
| `reported_at` | timestamptz | |
| `paperclip_reachable` | bool | Liaison could hit `:3100/api` |
| `paperclip_version` | text | |
| `agent_count` | int | |
| `agents_idle` / `agents_running` / `agents_error` | int | |
| `runs_last_hour` / `runs_failed_last_hour` | int | |
| `last_heartbeat_at` | timestamptz | newest agent run across the fleet |
| `recent_errors` | jsonb | `[{agent_id, signature, count, sample}]` |
| `fleet_status` | text | derived: `healthy \| degraded \| down` |

`fleet_status` rule: `down` if `!paperclip_reachable` or `last_heartbeat_at`
older than 3× the slowest heartbeat interval; `degraded` if `agents_error > 0`
or `runs_failed_last_hour / runs_last_hour > 0.25`; else `healthy`.

### `wavex_os.fleet_log_synthesis`
Pushed by the Liaison every ~6h. This is the **"are the agents doing the right
job"** rollup — the Liaison runs a claude pass over the Paperclip run logs.

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `device_id` | uuid | |
| `synthesized_at` | timestamptz | |
| `window_hours` | int | e.g. 6 |
| `runs_total` / `runs_ok` / `runs_failed` / `runs_timeout` | int | |
| `agents_silent` | jsonb | agents that should have woken but didn't |
| `effectiveness_score` | numeric(3,2) | 0..1 composite |
| `summary` | text | 1-paragraph synthesis from the Liaison's claude run |
| `flags` | jsonb | `[{severity, agent_id, note}]` operator-worthy items |

### `wavex_os.injection_outcomes`
Pushed by the Liaison after observing what the fleet did with an injection.
**This closes the loop on the prompt-injection promise** — `injection_queue_v2`
only knows an injection was *consumed*; this knows whether it was *acted on*.

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `injection_id` | uuid | FK `injection_queue_v2` |
| `device_id` | uuid | |
| `observed_at` | timestamptz | |
| `acted` | bool | assigned agent opened/worked the issue |
| `outcome` | text | `delivered_acted \| delivered_ignored \| delivered_failed \| not_delivered` |
| `evidence` | jsonb | `{issue_id, status_transitions, comment_count}` |
| `target_kpi` | text | |
| `kpi_before` / `kpi_after` | numeric | |
| `delivery_score` | numeric(3,2) | 0..1 — did the promise land |

RLS: customer can read their own device rows; operator (`has_role('admin')`)
reads all; the Liaison writes via its device-scoped service path.

## The watchdog

**Do not rebuild — evolve `scripts/ops/wavex-ops-cycle.mjs` (T5).** It already
runs every 15 min under launchd, already Telegram/Paperclip-escalates on CRIT.
Add:

- **Paid-fleet sweep** — read `instance_health` for every active `pool_b`
  subscription. Any `fleet_status = down`, stale `last_heartbeat_at`, or
  `agents_error` over threshold → a *covered incident*.
- **Remediation playbook library** — `scripts/ops/playbooks/*.mjs`. Each
  playbook: `match(health) → bool`, `remediate(ctx) → outcome`,
  `escalate(ctx)`. Remediation = emit a signed instruction into
  `injection_queue_v2` tagged `wavex:remediation` that the customer's Liaison
  applies locally (the cloud can't touch their box directly).
  - **Playbook #1** (born from the demo incident): signature = agent runs
    failing in ~1s with `Not logged in` / `Please run /login` → instruct the
    Liaison to re-point `adapterConfig.command` at the keychain wrapper and
    strip `CLAUDE_CONFIG_DIR`; if claude itself is logged out, escalate (only a
    human can re-auth).
- **SLA tiers** — paid: 5-min effective watch + auto-remediation attempts +
  immediate operator escalation on unrecoverable; free: best-effort hourly,
  surface-only.

## The admin instance

"the admin instance that will be overseeing the wavex experts" — a Paperclip
company **"WaveX Mission Control"** provisioned on the operator's box. Agents:

- **Admin CEO** — owns the oversight goal
- **Fleet Watchdog** — judgment layer over the ops-cycle's mechanical checks
- **Expert QA** — reads `injection_outcomes` + `fleet_log_synthesis`, verifies
  the Expert Agents are actually delivering value (not just being consumed)
- **Incident Responder** — runs the remediation playbooks, escalates what it
  can't fix

The T5 ops-cycle becomes this instance's heartbeat trigger; the mechanical
checks stay in the script, the *synthesis + judgment + escalation* move into the
agents (they need an LLM, the script doesn't).

## Deployment — answering "should we deploy locally?"

| Component | Where | Why |
|---|---|---|
| **Operator dashboard** | **Cloud** — admin section of `wavexcard.com/os` console | Reads the cloud SoT; operator needs it from anywhere, not just this laptop; reuses console auth + shell; the "back covered" promise **cannot depend on the operator's laptop being awake**. Zero new hosting. |
| **Admin Paperclip instance** | **Local launchd** — this laptop now, a dedicated always-on Mac before scaling | Paperclip runs `claude` (Max OAuth keychain — the thing we just fought); needs a real macOS login session. Cannot be "cloud" without a hosted Mac. Same launchd pattern as the customer fleet. |
| **Watchdog logic** | **Local launchd** — extend T5 ops-cycle | Already there, already escalates; graduates into the admin instance's agents. |

Net new hosting: **none.** The dashboard rides the console you already have; the
admin instance + watchdog ride launchd on a Mac you already run.

## Build phases

| Phase | Where | Work |
|---|---|---|
| **1** | local + Supabase | Apply the 3 migrations; extend the Liaison template to push `instance_health` + `fleet_log_synthesis`. **Unblocks everything else.** |
| **2** | local | Extend `wavex-ops-cycle.mjs` paid-fleet sweep + `scripts/ops/playbooks/` (playbook #1 = the auth fix) |
| **3** | local | Provision the "WaveX Mission Control" admin Paperclip instance + its 4 agent templates |
| **4** | cloud | The operator dashboard — **this is the Lovable agent's job** → `docs/LOVABLE_CONSOLE_PROMPT.md` |
| **5** | local | `injection_outcomes` loop-closing — Liaison observes act/ignore/fail per injection, computes `delivery_score` |

Phases 1–3 + 5 are wavex-os backend work (this repo). Phase 4 is the cloud
console — handed to Lovable via the prompt.
