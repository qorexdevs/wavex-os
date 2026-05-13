# Liaison Agent — Hooks, Events, Routines

Complete enumeration of every clock tick, every external event the Liaison responds to, and every signal it produces. Useful when debugging "why didn't the Liaison fire?" or "what's the worst-case storm?"

---

## 1. Clocks the Liaison runs against

| Clock | Cadence | Source | What fires |
|---|---|---|---|
| **Paperclip heartbeat-timer** | Every 5 min (cron `*/5 * * * *`) | `~/Library/LaunchAgents/com.paperclip.heartbeat-timer.plist` | The Liaison agent's `claude` CLI spawn — runs the 4-step heartbeat (build → upload → poll → deliver) |
| **JWT TTL refresh** | Every 24h (or on 401) | Liaison-internal | Refreshes `SUBSCRIPTION_JWT` via `POST /functions/v1/refresh-subscription-jwt` |
| **Supabase access-token expiry** | Every ~1h (Supabase default) | Liaison-internal | Refreshes via `supabase.auth.refreshSession()` |
| **Fleet digest TTL** | 24h auto-delete | Supabase `ttl_at` column | Server-side; Liaison just keeps uploading every 5 min |

---

## 2. Server-side worker clocks (the FAR side of the loop)

These are the clocks ON the Mac mini / api.wavex-os.com that produce the injections the Liaison consumes:

| Worker | Cadence | Cron | Tier required |
|---|---|---|---|
| `expert-worker-optimizer` (board nudges) | Once/day | `7 9 * * *` (America/New_York morning) | founder+ |
| `expert-worker-alignment` (KPI drift) | Hourly business hours | `0 9-21 * * 1-5` | growth+ |
| `expert-worker-error-handler` (cluster triage) | Every 30 min during business | `*/30 9-21 * * 1-5` | growth+ |
| `expert-worker-concierge` (continuous review) | Every 5 min | `*/5 * * * *` | custom only |

The Liaison's 5-min polling cadence is faster than every worker except concierge — so injections from optimizer/alignment/error-handler will sit in the queue at most 5 min before the Liaison pulls them.

---

## 3. Wake reasons the Liaison handles

In addition to the scheduled 5-min heartbeat, Paperclip will wake the Liaison with these `wake_reason` strings. Each branches to a slightly different cycle shape:

| wake_reason | Triggered by | What the Liaison does differently |
|---|---|---|
| `scheduled` (default) | heartbeat-timer 5-min cron | Standard build→upload→poll→deliver |
| `ignition_kickoff` | Activate-time bootstrap from `bridge/ignition.ts` | Standard cycle + extra: register the per-catalog signing public keys in `expert-agent-pinned-keys.json` (TOFU) |
| `board_directive` | Operator sent a Telegram message mapped to `directive` via `board-escalation-classifier` | Standard cycle + check if any directives queued for the Liaison itself (e.g. "pause optimizer") |
| `recovery_protocol` | Paperclip's recovery system detected the Liaison hasn't completed in N cycles | Skip upload, poll the queue ONLY, flush deferred state |
| `kpi_breach` | Goal Keeper / Alignment posted a critical KPI movement | Standard cycle + flag to the next CEO directive that an inflection was just delivered |
| `missing_issue_comment` | Paperclip retry after Liaison cycle exited without posting status | Re-post the prior cycle's status comment from `~/.wavex-os/state/liaison-last-cycle-report.txt` |

---

## 4. Events the Liaison RECEIVES

### From Paperclip (local fleet, customer's Mac, port 3100)

| Endpoint | Why Liaison hits it | Expected response |
|---|---|---|
| `GET /api/companies/<id>/issues?limit=200` | Build `open_issue_titles` + `issue_bodies` digest fields | JSON array of issues |
| `GET /api/companies/<id>/agents` | Build `fleet_status` + `agent_status` | JSON array of agents |
| `GET /api/companies/<id>/goals` | Build `goal` field | JSON array (1 or 0 goals) |
| `GET /api/companies/<id>/kpis?since=24h` | Build `kpi_snapshots` | JSON of latest values |
| `GET /api/companies/<id>/kpis?delta=true` | Build `kpi_deltas` | JSON of deltas vs baseline |
| `GET /api/companies/<id>/runs?status=failed&limit=50` | Build `failed_runs` | JSON of failed runs |
| `GET /api/companies/<id>/comments?limit=50` | Build `comments` field | JSON of recent comments |
| `GET /api/companies/<id>/monte-carlo-baseline` | Build `monte_carlo_baseline` | Forecast vector |

All read-only. Liaison never POSTs to local Paperclip during the digest-build phase.

### From WaveX server (api.wavex-os.com)

| Endpoint | Expected response codes |
|---|---|
| `POST /v1/optimizer/queue/<sub_id>` | `200` with `{ injections, next_poll_at }` / `402` lapsed / `429` rate-limited / `503` frozen |
| `POST /functions/v1/refresh-subscription-jwt` | `200` with new JWT / `401` re-auth |

### From Supabase (over HTTPS)

| Endpoint | Trigger | Liaison's response |
|---|---|---|
| `POST /rest/v1/wavex_os/fleet_digests` returns `201` | After upload of envelopes | Continue cycle |
| `POST /rest/v1/wavex_os/fleet_digests` returns `401` | Access token expired | Refresh via supabase.auth + retry once |
| `POST /rest/v1/wavex_os/fleet_digests` returns `403` | RLS denied (subscription canceled) | Idle quietly, do NOT page operator |
| `PATCH /rest/v1/wavex_os/injection_queue_v2?id=eq.<id>` returns non-2xx | Failed to mark consumed | Re-serve on next poll (idempotency by id at delivery target) |

---

## 5. Events the Liaison PRODUCES

### Uploads to Supabase (Liaison → server-side workers)

| Object | Endpoint | Cadence | Side effects |
|---|---|---|---|
| Fleet digest with field_envelopes | `POST /rest/v1/wavex_os/fleet_digests` | 5 min (or skipped if digest empty) | Workers can decrypt + audit on next cron |
| Injection consumed | `PATCH /rest/v1/wavex_os/injection_queue_v2?id=eq.<id>` | Per successful delivery | Worker won't re-issue same injection_id |

### Writes to local Paperclip (Liaison → fleet)

These are the customer-visible outputs of the entire loop. Each is signed by a server-side worker via Ed25519; the Liaison verifies the signature before posting.

| kind | Endpoint | Author attribution | Issued by |
|---|---|---|---|
| `issue_comment` | `POST /api/issues/<key>/comments` | `author_kind: wavex_expert_agent` + `source_catalog: <catalog_id>` | Optimizer / Concierge |
| `new_issue` | `POST /api/companies/<id>/issues` | tag `wavex:expert-issued` + `source_catalog` | Any of the 4 |
| `workflow_proposal` | `POST /api/issues/<key>/interactions` | `kind: suggest_tasks` + `source_catalog` | Concierge mostly |
| `spawn_throttle_call` | `POST /api/maintenance/spawn-throttle` | `reason: wavex:<catalog>` | Error Handler / Concierge only (catalog `output_types` enforces) |
| `human_escalation` | `POST /api/pillar5/send-board-message` | `source_catalog` | Concierge only |

### Self-status (Liaison → its own routine issue)

Every cycle ends with one comment on its routine issue:

```
LIAISON CYCLE — <timestamp>
hires_active: <N>
fields_uploaded: <list>
injections_received: <N>
injections_delivered: <N>
injections_rejected: <N>  reason: <if any>
NEXT_HEARTBEAT_AT: <ts+5min>
```

---

## 6. Routines (the named schedules)

| Routine name | Owner | Cadence | Outcome |
|---|---|---|---|
| Liaison heartbeat | Liaison agent | 5 min | Digest uploaded, injections consumed |
| Catalog signing-key refresh | Liaison agent | On `ignition_kickoff` only | TOFU pin in `expert-agent-pinned-keys.json` |
| JWT refresh | Liaison agent | 24h or on 401 | New token in `subscription.json` |
| `expert-worker-optimizer` cron | Mac mini server | Once/day 9:07am NY | One board nudge per active subscription |
| `expert-worker-alignment` cron | Mac mini server | Hourly business hours | Drift correction or no-op |
| `expert-worker-error-handler` cron | Mac mini server | Every 30 min business hours | Cluster triage + recovery comment |
| `expert-worker-concierge` cron | Mac mini server | Every 5 min (Custom tier only) | Continuous review |
| Digest TTL cleanup | Supabase (operator manages) | Hourly | Rows >24h expired auto-deleted |
| Usage ledger billing rollup | Server-side (lands with billing UI) | Daily 00:30 UTC | Aggregate cost per subscription for that day |

---

## 7. Failure modes + Liaison response

| Failure | Liaison reaction |
|---|---|
| `api.wavex-os.com` unreachable | Continue building digests locally; skip upload + poll; alert only after 24h consecutive failures |
| Local Paperclip API 500 | Skip cycle, file BLOCKED issue, retry next heartbeat |
| Signature mismatch on injection | REJECT, file `[REJECTED-INJECTION]` high-priority issue, log to `expert-agent-pinned-keys.json` audit history |
| TOFU pin mismatch (signing key changed) | REJECT, surface to Mission Control "Re-consent required" banner |
| Injection >1h old (replay window) | REJECT, log |
| JWT expired AND refresh fails | Idle, retry next heartbeat |
| Subscription `paused` server-side | Idle, no alarm |
| Subscription `canceled` server-side | Idle, surface "Your subscription ended" via Privacy Panel |
| Encrypt-envelopes finds no recipients (no active hires) | Skip upload entirely — nothing for anyone to read |

---

## 8. Worst-case event storm

To bound the maximum traffic a single Liaison can generate:

- Every 5 min × 12 = 12 cycles/hour
- Per cycle: ~8 read calls to local Paperclip + 1 upload to Supabase + 1 poll to Mac mini + (up to 5) delivers + 1 status comment
- = ~16 HTTP calls/cycle × 12/hour = ~192 HTTP calls per Liaison per hour

Per 100 customers on Custom tier (all 4 hires active, every 5 min worker producing maximum 1 injection per cycle):
- 100 × 192 = 19,200 Liaison HTTP calls/hour
- 100 × 1 × 12 = 1,200 injections/hour to deliver
- 100 × 12 = 1,200 digest uploads/hour to Supabase

Supabase free tier handles ~500 concurrent connections — comfortable. The Anthropic rate limit on Claude Max 20× (3.84M tokens / 5h) is the real ceiling, and it's why capture C said "~25-30 paying customers" before needing the Hetzner migration.
