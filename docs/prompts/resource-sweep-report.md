# Resource sweep report — Telegram alert formatter

**Purpose:** When the 15min `resource-sweep.sh` job trips a YELLOW/ORANGE/RED threshold, format the snapshot into a Telegram message that's actionable in under 5 seconds.

**Caller:** `scripts/wrappers/resource-sweep.sh` → `POST /api/maintenance/page-operator` → this prompt (server-side) → Telegram bridge.

**Pool:** platform — runs on the operator's Mac in the existing wavex-os-server. Haiku, tiny tokens.

**Model:** Haiku 4.5. ~500 input, ~150 output.

## Inputs

| Variable | Description | Source |
|---|---|---|
| `{{SNAPSHOT}}` | `{disk_pct, disk_pct_after, disk_freed_pct, ram_pressure_mbps, inference_burn_pct, actions, ts}` | resource-sweep output |
| `{{THRESHOLD_TRIPPED}}` | `disk_yellow | disk_orange | disk_red | ram_yellow | ram_orange | inference_orange` | resource-sweep logic |
| `{{LAST_ALERT_TS}}` | When we last sent a Telegram alert about this metric (for dedup) | local state file |

## Output schema

```jsonc
{
  "should_send": "boolean — false if we already alerted on this metric within last hour",
  "severity": "string — yellow|orange|red",
  "message": "string — Telegram-ready, ≤300 chars, lead with the actionable bit"
}
```

## Prompt body

```
You are formatting a resource-pressure alert for Omar's Telegram. He is
on the move, will read this on his lock screen, and needs to know in 2
seconds: how bad, what's happening, do I need to act NOW?

Snapshot:
{{SNAPSHOT}}

Threshold tripped: {{THRESHOLD_TRIPPED}}

Last alert about THIS metric was sent at: {{LAST_ALERT_TS}} (or never)

Rules:

1. Dedup: if LAST_ALERT_TS is within 1 hour and severity is YELLOW or
   ORANGE → should_send=false. RED always sends regardless.
2. Lead with severity emoji + the number that matters:
   - 🟡 YELLOW = passive notice
   - 🟠 ORANGE = action queued (automation took it)
   - 🔴 RED = operator action needed NOW
3. Format: "<emoji> <metric> <pct>% — <one-sentence what's happening>.
   <one-sentence what was done OR what operator should do>."
4. NEVER use the words "URGENT", "EMERGENCY", "OVERRIDE" — those words
   trip operator stress responses faster than the actual situation
   warrants. Let the emoji do that work.
5. Always include 1 number in the message. "Disk almost full" is bad.
   "Disk 91%" is good.
6. For RED specifically: end with "Reply 'pause' to throttle all
   spawns" so Omar has a one-tap recovery.

Examples:

✓ Good:
"🟠 Disk 84%. Resource sweep freed 3pp from worktrees, paused new agent
spawns. Watching."

✓ Good:
"🔴 Disk 91%. Postgres at risk of extend failure. Reply 'pause' to
throttle all spawns."

✓ Good:
"🟡 Inference burn 72% of daily cap. Pool C may throttle later today."

✗ Bad:
"URGENT: System resources critical, immediate action required."
^ stress framing, no numbers, no recovery path.

Return ONLY the JSON object.
```

## Failure mode + fallback

If the LLM call fails, the resource-sweep.sh script falls back to a templated string:

```
"[<severity>] <metric>=<pct> at <ts>. Actions: <actions_list>."
```

This is uglier but always works. The Telegram bridge then sends it without any formatting beyond the severity prefix.

## Dedup detail

The "last alert ts per metric" is stored in `~/.wavex-os/state/alert-dedup.json`:

```json
{
  "disk_pct_yellow": "2026-05-12T18:00:00Z",
  "disk_pct_orange": null,
  "disk_pct_red": null,
  "ram_pressure_yellow": "2026-05-12T17:45:00Z",
  "inference_burn_orange": null
}
```

Updated by the page-operator endpoint after each send. Reset to null when the metric returns below threshold. The dedup window is 1 hour for YELLOW/ORANGE, 15 min for RED (because RED is rare and you genuinely want repeated pings if you haven't responded).
