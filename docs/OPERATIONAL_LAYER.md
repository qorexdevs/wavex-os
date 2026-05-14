# Operational Layer — Deliverable Ledger, Token Economics & the Git Engineer

**Status:** design — pending operator go-ahead. Extends
`REDUNDANCY_ARCHITECTURE.md`.
**Driver (2026-05-14):** Expert Agents today are *advisory* — they file a
directive, the local fleet decides. The operator wants them *operational*: they
also change the customer's **codebase** (GitHub) and **database** (Supabase).
And every unit of work — local swarm or Expert — must be a tracked, attributed,
**token-costed** deliverable with full accountability.

## The shift: advisory → operational

```
 BEFORE (F.4/F.5)   Expert Agent → directive → injection_queue_v2 → Liaison
                    → Paperclip issue → local fleet decides

 AFTER              Expert Agent → proposal (directive | code_change |
                    db_migration) → injection_queue_v2 → Liaison → local
                    Git Engineer implements → PR on the customer's repo
                    → every step a ledgered, token-costed deliverable
```

## 1. The Deliverable Ledger — accountability

Every unit of agent work is a **Deliverable** with an explicit contract:

```
plan_ref → expected_response → assigned_agent → artifacts → token_cost → status
```

- **Local:** extends Paperclip issues. The `plan_ref` + `expected_response`
  contract becomes explicit issue metadata — no more fuzzy "agent did some
  work." Every issue states what plan it serves and what "done" looks like.
- **Cloud mirror:** new `wavex_os.deliverable_ledger` — so **Mission Control
  (local *and* the cloud console) shows one unified accountability record**:
  which agent(s) touched which issue, what they delivered, what it cost.

### `wavex_os.deliverable_ledger`

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `device_id` / `subscription_id` | uuid | |
| `plan_ref` | text | the plan / roadmap item / injection this serves |
| `issue_id` | text | local Paperclip issue id |
| `expected_response` | text | the contract — what "done" means |
| `assigned_agent` | text | accountable agent (local slot or expert catalog_id) |
| `contributing_agents` | jsonb | every agent that touched it |
| `kind` | text | `directive \| code_change \| db_migration \| routine` |
| `artifacts` | jsonb | issue comments, commit SHAs, PR url, migration file |
| `tokens_in` / `tokens_out` / `tokens_cache` | bigint | **economics in tokens** |
| `status` | text | `open \| in_progress \| delivered \| verified \| failed` |
| `opened_at` / `delivered_at` / `verified_at` | timestamptz | |

## 2. Token economics — not USD

The operator's inference is flat-rate Claude Max; USD is meaningless
(`cost_cents` is often 0). **Tokens are the real scarce resource.** So:

- `usage_ledger` gains `deliverable_id` + `agent_id` attribution columns.
- **Hub-routed inference is self-accounting:** any call through the Cloudflare
  tunnel → operator hub is already logged to `usage_ledger` with token counts.
  This is a direct argument for routing Pool B inference through the tunnel
  (§5) — you get per-deliverable token telemetry for free.
- BYO-OAuth local calls are invisible to the hub; the Liaison best-effort
  synthesizes their token counts from Paperclip run records.
- **Every UI surfaces tokens, never USD** — per-deliverable, per-agent,
  per-instance rollups. `cost_cents` stays only for Stripe billing recon.

## 3. The 4h instance check — Pool B execution wrapping

"Wrap the whole execution" = the deliverable-ledger contract applied rigorously
to Pool B, closed by a fixed-cadence check.

- `fleet_log_synthesis` cadence → **4h** (revised from 6h in
  `REDUNDANCY_ARCHITECTURE.md`).
- The **4h instance check** is a *defined method*, not a vibe: read the
  deliverable ledger for the window → are deliverables landing on-contract? →
  is token burn proportionate to output? → any silent agents? → any
  expected_response unmet? → write the synthesis + `flags`.
- Paid (Pool B) fleets get the 4h check unconditionally; free is best-effort.

## 4. The Git Engineer — operational code & DB changes

### Where it runs: LOCAL, never cloud

The customer's code must **never enter WaveX infra** — consistent with the
entire F.4 privacy model (field envelopes, redaction, sealed boxes). So:

- **Cloud `code-engineer-v1`** (new `expert_agent_catalog` entry) only
  *proposes*: it emits `injection_queue_v2` rows of `kind = 'code_change'` or
  `'db_migration'` — a **structured proposal** (intent, target files/tables,
  rationale, acceptance criteria), not a raw diff against code it cannot see.
  (`injection_queue_v2.kind` is free `text` — no constraint migration needed.)
- **Local Git Engineer** — a new role in the customer's Paperclip fleet (or a
  capability on their existing CTO/eng agent). Receives the proposal via the
  Liaison, implements it **on the customer's box** with the customer's own
  GitHub + Supabase credentials, and opens a **PR**.

### GitHub embedding — auth model

**Recommendation: a GitHub App.** Org-installable, fine-grained per-repo
scopes, customer-revocable in one click, short-lived installation tokens that
never persist in WaveX. Alternatives: a fine-grained PAT (simpler, but
customer-managed and longer-lived) or OAuth (user-scoped, awkward for an
autonomous agent). **This is the one decision I want the operator's explicit
pick on before Phase 9 builds** — it has an external setup dependency.

### DB via Supabase — migrations-as-code

`db_migration` deliverables are **never blind-applied to prod**. The Git
Engineer commits a migration file in the *same PR* as any code change, applies
it to a branch/preview database first, and the migration ships only when the PR
merges. The customer connects their own Supabase project; WaveX never holds
their service-role key.

### Safety rails (non-negotiable for v1)

- **PR-only.** Never direct-to-main. Never auto-merge.
- The customer's **own eng/CTO agents do first-pass review** of the Expert's
  proposal before the Git Engineer implements — the fleet reviews the outsider.
- Every code/db deliverable is a `deliverable_ledger` row attributing **both**
  the proposing cloud Expert and the implementing local Git Engineer, with
  token cost.
- **Kill switch:** revoke the GitHub App install, or pause the hired Expert —
  either stops operational changes immediately.

## 5. Inference transport — Cloudflare tunnel (recommended)

"handle the inference using the tunnel via cloudflare (if you see fit)" — **yes,
this is the right call**, and it's already half-built: the
`com.wavex-os.cloudflared` launchd template, the `inference-server`, the
`@wavex-os/cloud-client` package, and the device-JWT validator all exist.

- The customer's local fleet — including the Git Engineer — does inference via
  `cloud-client` → **Cloudflare tunnel → operator inference hub**, gated by the
  device JWT.
- Governed by the existing **Max allocation slider** (swarm vs Pool A share) —
  code-generation is token-heavy and must not be allowed to drain the operator
  window uncapped.
- **BYO-OAuth** (Pool B's original design) stays the fallback for `growth` /
  `custom` tier — heavy code-gen users bring their own Claude so the operator's
  Max isn't the bottleneck. The hub path is the default for `founder` tier.
- Bonus, per §2: hub-routed = automatically token-accounted.

## 6. Mission Control unification

Both surfaces get a **Deliverable Ledger** view (this is the "unify in Mission
Control" ask):

- **Local** — new panel in `packages/onboarding-ui/src/pages/MissionControl.tsx`
- **Cloud** — `docs/LOVABLE_CONSOLE_PROMPT.md` amended with a Deliverable Ledger
  section (customer console: their deliverables + token spend; operator
  console: cross-fleet accountability + which Expert proposed what)

## Build phases (extends `REDUNDANCY_ARCHITECTURE.md` phases 1–5)

| Phase | Where | Work |
|---|---|---|
| **6** | local + Supabase | `deliverable_ledger` table + Paperclip issue contract (`plan_ref` / `expected_response`) + `usage_ledger` attribution columns |
| **7** | local | 4h instance-check method — extend `fleet_log_synthesis` cadence + the defined check procedure |
| **8** | cloud + Supabase | `code-engineer-v1` catalog entry + `code_change` / `db_migration` injection kinds + Liaison routing |
| **9** | local | Git Engineer local role + **GitHub App** integration + Supabase migrations-as-code + safety rails — *blocked on the auth-model decision* |
| **10** | local | Inference via Cloudflare tunnel hardening + allocation-slider coverage of Pool B code-gen |

Phases 6–10 are sequenced after Phases 1–3 (the redundancy/observability
foundation) — the deliverable ledger needs `instance_health` + the Liaison push
path to exist first.
