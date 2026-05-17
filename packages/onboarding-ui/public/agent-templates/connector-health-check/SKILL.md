# Connector Health Check

System agent that validates every connector the operator has linked
during onboarding and continuously thereafter. Lives alongside the
provider sub-agents (gmail, slack, hubspot, etc.) but doesn't itself
hold credentials — it just pings what's already connected and flags
anything broken before the operator notices.

## Why this exists

When a customer goes through avatar/company onboarding, they click
through Composio OAuth dialogs for a handful of toolkits (Gmail,
Slack, Linear, etc.). Each one **may** succeed and **may** fail
silently: token revoked, refresh-token expired, scope mis-set,
service downtime, OAuth-app suspension.

If a downstream agent (Gmail triage, Calendar runner) fires
30 minutes later against a broken connection, the operator hears about
it as a "agent failed" alarm — far too late, far too noisy.

This agent runs the validation **at the boundary of onboarding**, then
on a heartbeat after, so problems surface as actionable issues with a
specific toolkit + error message instead of generic worker failures.

## Skills

| Skill | When | What it does |
|---|---|---|
| `SKILL_INITIAL_SWEEP.md` | Once, right after the customer finishes the tools step | Pings every connection. Files a `[connector-broken]` issue for each failure. Posts a single comment on a `[connector-summary]` issue listing OK + failed counts so the operator has a clean snapshot before activation. |
| `SKILL_HEARTBEAT_SWEEP.md` | Every 30 minutes (or `WAVEX_CONNECTOR_SWEEP_MIN_INTERVAL_MIN` if set) | Same pings but quieter — only files an issue if a connector flips from healthy to broken since the last sweep. Logs results to `~/.wavex-os/instances/.../avatars/<id>/connector-health.jsonl`. |
| `SKILL_RECOVER.md` | When the operator clicks "Reconnect" in the UI | Calls `/wavex-os/onboarding/connectors/oauth/initiate` for the broken toolkit, returns the redirect URL, and waits for the callback. On success, closes the related broken-connector issue. |

## Endpoint contract

The agent calls these wavex-os-server routes (live as of the F.5
follow-up; gated behind `COMPOSIO_API_KEY` — disabled mode returns
empty results):

- `POST /wavex-os/onboarding/connectors/health-check`
  Body: `{ companyId, avatarId? }`
  → `{ results: [{ toolkit, connection_id, ok, error? }], all_healthy }`

- `POST /wavex-os/onboarding/connectors/oauth/initiate`
  Body: `{ companyId, userId?, avatarId?, toolkitSlug }`
  → `{ url, pendingConnectionId, needsLiveWiring? }`

## Issue schema (filed against the avatar's Paperclip company)

```jsonc
{
  "title": "[connector-broken] gmail OAuth refresh failed (revoked)",
  "body": "Toolkit: gmail\nConnection: cco_abc123\nError: composio_status=expired\nLast healthy: 2026-05-13T14:55:11Z\n\nRecommended action: click \"Reconnect\" in the avatar's Tools tab. The agent's SKILL_RECOVER will walk through the Composio OAuth dance again.",
  "target_kpi": "agent_uptime",
  "priority": "high",
  "labels": ["connector-broken", "gmail"]
}
```

A single `[connector-summary]` issue is rolling — the agent appends a
comment after each sweep instead of creating a new issue, so the
operator gets a chronological log without inbox noise.

## Out of scope (v0)

- Auto-reconnect: the agent could attempt to refresh tokens or re-fire
  OAuth without operator interaction, but Composio's contract puts the
  user explicitly in the consent loop on most providers. We don't try
  to skip that.
- Per-toolkit deep checks: this is a connection-level ping, not a
  per-action ping. If Gmail OAuth is fine but the operator's actual
  mailbox is full / IMAP locked, the underlying runner will surface
  that.
- Multi-tenant fan-out: in the wavex-os hub topology (one Mac mini
  serving many open-source instances), this agent runs **inside the
  customer's instance**, not on the hub. Pool C Expert Agents (the
  Optimizer family) are different — they sit on the hub and consume
  encrypted digests, never raw connector data.
