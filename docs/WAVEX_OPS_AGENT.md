# WaveX Ops Agent — operator-side reliability cycle

The WaveX Ops agent is a launchd-driven 15-minute cycle that watches signals
the operator owns across all customers, distinct from the fleet-internal
`system-reliability` agent (which watches disk/RAM/inference *inside* each
customer's fleet).

## What it watches

| Probe | Source | What triggers a finding |
|---|---|---|
| Manifest health | `~/.wavex-os/instances/default/companies/*/onboarding/company.manifest.json` | `goal.kpiId=null`, `signed_at=null`, or finalized >24h ago with no triggered-heartbeats activity |
| Stripe webhook arrival | `wavex_os.stripe_webhook_events` via public RPC | >24h since last event AND active subscriptions exist (CRIT) |
| Stripe webhook handler errors | same | any `processing_error` IS NOT NULL in last 24h (WARN) |
| Pool A inference health | `~/.wavex-os/state/t2-events.jsonl` | >25% non-zero `exit_code` in last 60 min |
| Hub inference freshness | `~/.wavex-os/state/inference-current.json` | mtime older than 30 min (WARN) |
| Catalog hire counts | `wavex_os_ops_catalog_hire_counts` RPC | 0 active hires for any catalog agent (INFO — informs marketplace prune) |

Severity ladder:
- **INFO** — recorded but no action; ledger entry for week-over-week trend
- **WARN** — recorded + mirrored to `wavex-ops-cycle.log` for grep
- **CRIT** — same as WARN + Telegram + Paperclip issue (if configured)

## Where output goes

| File | What | Cleaned? |
|---|---|---|
| `~/.wavex-os/state/ops-events.jsonl` | One JSON record per cycle, all findings | **Never.** Logs are training data. |
| `~/.wavex-os/state/wavex-ops-cycle.log` | WARN+ findings in grep-friendly format | Append-only |
| Telegram | CRIT findings only, Markdown formatted | n/a |
| Paperclip issue | CRIT findings only, on configured "WaveX Ops" company | n/a |

## Installation

1. **Render the plist template** into `~/Library/LaunchAgents/`:
   ```sh
   node scripts/render-launchd-templates.mjs
   ```
   The `com.wavex-os.ops-cycle.plist.tmpl` is auto-discovered.

2. **Load the launchd job**:
   ```sh
   launchctl load -w ~/Library/LaunchAgents/com.wavex-os.ops-cycle.plist
   ```
   Cadence: every 900 s (15 min). `RunAtLoad=true` so the first cycle fires
   immediately on boot.

3. **Confirm it's running**:
   ```sh
   launchctl list | grep wavex-os.ops-cycle
   tail -f ~/.wavex-os/state/wavex-ops-cycle.log
   ```

## Configuration (all via env in `~/.wavex-os/state/.env`)

| Var | Default | Purpose |
|---|---|---|
| `SUPABASE_URL` | required | Stripe + catalog probes via public RPCs |
| `SUPABASE_SERVICE_ROLE_KEY` | required | same |
| `WAVEX_OPS_TELEGRAM_BOT_TOKEN` | unset → silent | Telegram alerts on CRIT |
| `WAVEX_OPS_TELEGRAM_CHAT_ID` | unset → silent | same |
| `WAVEX_OPS_PAPERCLIP_URL` | `http://127.0.0.1:3100` | Paperclip endpoint for issue filing |
| `WAVEX_OPS_PAPERCLIP_COMPANY_ID` | unset → no issues filed | Target company for CRIT issues |
| `WAVEX_OPS_STALE_HOURS` | `24` | Manifest activity gap threshold |
| `WAVEX_OPS_STRIPE_QUIET_HOURS` | `24` | Stripe quiet threshold |
| `WAVEX_OPS_T2_ERROR_THRESHOLD_PCT` | `25` | Pool A error-rate threshold |

The cycle degrades gracefully when env vars are missing: probes that need
Supabase log `STRIPE.SKIPPED`; missing Telegram skips notification silently;
missing Paperclip company skips issue filing.

## How to read `ops-events.jsonl`

Each line is one cycle:

```json
{
  "ts_iso": "2026-05-13T22:13:30.831Z",
  "cycle_id": "ops-1778710410826-nhds6x",
  "findings_count": 6,
  "severity_max": 1,
  "findings": [
    { "severity": "WARN", "code": "MANIFEST.GOAL_NULL",
      "summary": "Company doux finalized but goal.kpiId is null",
      "detail": { "company_id": "doux", "finalized_at": "..." } }
  ]
}
```

Useful queries:

```sh
# CRITs only, last 7 days
jq -c 'select(.severity_max==2)' ~/.wavex-os/state/ops-events.jsonl

# Frequency of each finding code in last 24h cycles
cat ~/.wavex-os/state/ops-events.jsonl | \
  jq -r '.findings[] | .code' | sort | uniq -c | sort -rn

# Companies repeatedly flagged for stale fleet
cat ~/.wavex-os/state/ops-events.jsonl | \
  jq -r '.findings[] | select(.code=="MANIFEST.STALE_FLEET") | .detail.company_id' | \
  sort | uniq -c | sort -rn
```

## Adding new probes

Each probe is a thin async function in `scripts/ops/wavex-ops-cycle.mjs` that
calls `record(severity, code, summary, detail)`. Add new ones to the
`Promise.all([...])` in `main()`. New Supabase-side probes should go through
public RPCs (see migration `20260513000012`) rather than direct schema queries
— `wavex_os` is intentionally not REST-exposed.

## What this agent does NOT do

- **Does not act on findings** beyond filing notifications. The operator (you)
  decides what to fix. Future iteration: T5.b (auto-remediation) for
  well-bounded fixes like re-running `finalize` on a goal-null manifest.
- **Does not modify customer fleets.** All writes are operator-side state.
- **Does not poll Paperclip companies.** Per-company internal health is the
  job of the customer's fleet `system-reliability` agent.

## Verification on first install

After loading the plist:

```sh
# Force one cycle immediately
launchctl start com.wavex-os.ops-cycle

# Confirm it wrote an event
tail -1 ~/.wavex-os/state/ops-events.jsonl | jq

# Confirm next scheduled tick is +15min
launchctl print gui/$(id -u)/com.wavex-os.ops-cycle | grep -E "next|state"
```

If `findings_count == 0` and `severity_max == 0`, you're green. Otherwise
read the findings array — that's your day-1 to-do list.
