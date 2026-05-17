# Mission Control Roles — V2 (autonomous fix layer)

WaveX Mission Control is the operator's internal Paperclip company that
oversees the paying-customer fleet (companyId
`b6261181-2e3b-40de-bb66-7f2928ca7e23`, runs locally against
`http://127.0.0.1:3100`). V1 (provisioned in task #125) was the **observation
layer**: agents detected, judged, escalated. V2 adds the **action layer** —
three new agents that apply fixes autonomously so the operator can read
digests instead of doing on-call.

## V1 agents (observation — unchanged)

| Slug | Role | Authority |
|---|---|---|
| `admin-ceo` | Triage + orchestration | Routes issues, closes resolved ones |
| `fleet-watchdog` | Judgment over FLEET.* incidents | Decides remediate vs escalate |
| `expert-qa` | Verifies Expert Agents | Flags underdelivering experts |
| `incident-responder` | Runs remediation playbooks | Operator-local fixes only |

## V2 agents (action — new)

| Slug | Role | Authority | Escalation chain |
|---|---|---|---|
| `customer-success-engineer` | Per-customer fix-or-escalate. Diagnoses one paying user at a time from `wavex_os_admin_customer_overview()` and either Pool-C-injects guidance into their Concierge Ops or escalates to the operator. | Read all customer state (RPC, `usage_ledger`). Write a Pool-C injection into `injection_queue_v2`. Log audit rows in this admin instance. **No** direct customer-box access. | Admin CEO → operator Telegram (for `token-revoked`, prolonged `restart-needed`, `no-fleet` past 24h). |
| `platform-reliability-engineer` | SRE for the operator. Computes aggregate fleet metrics, watches per-customer cost spikes, probes operator-local launchd services (`/api/system/health`, mock-core, wavex-os-server, inference-server). | Read aggregate fleet state. File P1 (fleet regressions) or SEV0 (operator-local outage) issues. Coalesces — one issue per check per cycle. | Admin CEO → operator Telegram (always, on SEV0). |
| `build-engineer` | Owns the wavex-os codebase from the platform side. Watches GitHub `main` CI, customer-machine build failures (from daemon state in `instance_health`), and PRs touching sensitive paths (cloud-client, inference-server, auth-shim, migrations). | Open deliverables in `deliverable_ledger`. Write fix PRs on a branch and push (tagging operator). **Never auto-merge.** Frozen paths from `CLAUDE.md` → escalate text-only, no PR. | Admin CEO → operator Telegram (for failing main CI, sensitive-path PRs, frozen-path proposals). |

## Cadence

Each V2 agent has a routine triggering every 30 minutes (`*/30 * * * *` UTC)
with `coalesce_if_active`/`skip_missed`. Routines and triggers live under
project `Mission Control Ops` (`f0c1f878-ed3c-4c85-9b58-299d9843824d`).

| Agent | Routine ID | Trigger ID |
|---|---|---|
| customer-success-engineer | `5733f354-0f2e-4c39-975f-3f17f3580262` | `9000d5e1-c061-42cd-991b-7d726f7cfd49` |
| platform-reliability-engineer | `03a3276c-1c0f-4916-981b-4eee0ccea838` | `dae799b4-ab78-4dd8-a2ae-2cd2efba9ea7` |
| build-engineer | `36162115-5f9b-4f12-8c82-4a6e40f727bd` | `cf8947f0-4b68-4dad-a576-bb87be1aa60f` |

## Data plane

V2 agents read customer state via one SECURITY DEFINER RPC:

```
wavex_os_admin_customer_overview() → (user_id, email, tier,
  subscription_status, current_period_end, trial_end, device_count,
  last_heartbeat_at, fleet_status, requires_user_action,
  tokens_last_7d, cost_cents_last_7d)
```

Migration: `supabase/migrations/20260516000003_wavex_os_admin_customer_overview.sql`.
Granted to `service_role` only; the column `requires_user_action` is tolerated
as NULL until P3 ships its `instance_health` extension.

## What the operator sees

The operator no longer reads raw FLEET.* alerts as their primary signal.
Instead:

1. V2 agents handle ~80% of customer-shaped problems autonomously (Pool C
   injections + diagnostic deliverables).
2. The operator gets Telegram pings *only* on the residue: security events
   (revoked JWTs), sustained customer non-action, fleet-wide regressions,
   sensitive-path PRs, and frozen-path proposals.
3. The "customer interactions" rolling issue in the admin company is the
   operator's weekly read for everything that auto-resolved.

The shape: the operator's own fleet is now their tier-3 on-call, not them.
