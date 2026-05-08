# Self-Healing & Performance Optimization

**Status:** v0.2.0 — patterns extracted from a 7-day production deployment that survived multiple OAuth expirations, a stale-token wrapper bug, a Telegram alert flood, and a host shutdown without operator intervention beyond clicking "Refresh OAuth" twice.

This document is the architectural narrative. The reference implementation lives at `packages/healing/` and `packages/observability/`.

---

## The four failure modes we observed in production

In one week of running ~20 agents on Claude Max, we observed exactly four classes of failure that required intervention:

1. **OAuth token expiry** (every ~16h on Claude Max). Manifests as 401 storms across all workers simultaneously.
2. **Stale-token wrapper bug** — a wrapper script captured the token at provisioning time and never re-read the keychain. After a manual `claude /login`, every spawn still got the dead token.
3. **Concurrency races on refresh** — multiple users (or maintenance UI poll loops) clicked "Refresh OAuth" at once. All callers read the same `refresh_token`; only one exchange could succeed; the rest got `invalid_grant`. The keychain ended up with a one-shot token that had already been spent.
4. **Zombie agents + alert spam** — agents in unsuitable contexts running ≥5 heartbeats with 0 closed issues, while a notification plugin fired Telegram alerts on every failed run with insufficient deduplication.

All four are now handled without human intervention beyond a single confirmation click in the worst case.

---

## The four-layer self-healing architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 4 — Recovery Protocol (cold start, post-incident)        │
│    services/recovery-protocol.ts                                │
│    launchd: com.wavex-os.recovery-on-boot, com.…recovery-12h    │
└────────────────────────────────────────────────────────────────-┘
              ▲ wakes CEO + CoS with snapshot, files approvals
┌────────────────────────────────────────────────────────────────-┐
│  Layer 3 — Maintenance UI (human-in-the-loop, mobile-friendly)  │
│    server/src/routes/maintenance.ts                             │
│    UI: /instance/settings/maintenance                           │
└────────────────────────────────────────────────────────────────-┘
              ▲ "Reboot workers", "Refresh OAuth", health banner
┌─────────────────────────────────────────────────────────────────┐
│  Layer 2 — OAuth refresh service (concurrency-safe singleton)   │
│    packages/healing/oauth-refresh.ts                            │
│    POST /api/maintenance/oauth/refresh                          │
└─────────────────────────────────────────────────────────────────┘
              ▲ in-flight Promise + 30s cooldown + invalid_grant retry
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1 — Wrapper 401 self-heal (per-spawn, transparent)       │
│    scripts/wrappers/claude-anthropic-direct.sh                  │
└─────────────────────────────────────────────────────────────────┘
              ▲ detect 401 → call /oauth/refresh → re-exec same call
```

Most 401 episodes never make it past Layer 1. Layer 2 handles the genuine refresh. Layer 3 is the human safety net. Layer 4 closes the loop after a cold start.

---

## Layer 1: Wrapper 401 self-heal

The `claude-anthropic-direct.sh` wrapper sits between the orchestrator and the `claude` CLI. It does three things:

1. Reads the **live** Claude OAuth token from keychain on every spawn (not from a stale `.env`). Falls back to `.env` only on keychain ACL edge cases.
2. Detects rate-limit / usage-limit responses and re-execs with a cheaper Sonnet fallback (Sonnet 4.6 is ~5× cheaper than Opus 4.7).
3. Detects 401 / `authentication_failed` / `Invalid authentication credentials` errors and triggers Layer 2 (`POST /api/maintenance/oauth/refresh`), then re-execs with the same arguments and the same model.

Critical detail: rate-limit fallback swaps to a cheaper model; auth-failure fallback does NOT — Sonnet shares the same OAuth token, so it would 401 too. Recovery requires a fresh token, not a cheaper model.

All recovery events log to `~/.paperclip/state/wrapper-fallback-logs/fallback.ndjson` for forensics.

## Layer 2: OAuth refresh with concurrency lock

The refresh endpoint exchanges the keychain `refresh_token` against Anthropic's OAuth endpoint and atomically writes the rotated pair back to keychain.

Three constraints made this non-trivial:

1. **Refresh tokens are single-use.** A failed write between exchange and keychain update permanently invalidates the keychain `refresh_token`.
2. **Concurrent callers can't share a refresh.** If two requests fire simultaneously, both read the same `refresh_token`; only one exchange wins; the others get `invalid_grant` against an already-spent token.
3. **A `claude /login` race** can rotate the keychain between read and exchange — also producing `invalid_grant`.

The implementation uses an **in-flight Promise singleton** (`inflightRefresh`) plus a 30-second post-success cooldown. All concurrent callers `await` the same exchange and receive the same result. A single retry on `invalid_grant` after a 250 ms delay handles the `claude /login` race.

In production verification, 5 parallel callers all returned 200 with the same `newAccessTokenPrefix`.

## Layer 3: Maintenance UI

A phone-friendly single-column UI at `/instance/settings/maintenance`. The two CTAs:

- **Reboot workers** (always enabled). Kills live workers (SIGTERM → 10 s wait → SIGKILL), reruns the noop-detector with `--retry`, sends a Telegram receipt. Pre-flight: refuses with HTTP 409 if OAuth status is `expired` AND `force_through_bad_auth` is not explicitly set; auto-attempts Layer 2 refresh first.
- **Refresh OAuth** (Layer 2). Does the keychain-to-Anthropic exchange directly; succeeds without the user touching their Mac in the common case where the `refresh_token` is still valid.

Health banner at the top probes OAuth status with a layered signal:

- `claude auth status` is unreliable (it reports `loggedIn:true` even when Anthropic is rejecting the token with 401).
- Canonical signal: `recentWorkerFailures` from `heartbeat_runs` — if ≥3 workers died with `error_code='adapter_failed'` in the last 5 min, status flips to `expired`.
- Optional probe: a real `claude -p` call (~$0.10) when the user clicks **Recheck**.

## Layer 4: Recovery Protocol

After a host shutdown / OAuth cluster failure / server crash, agents will mechanically respawn but won't know that the system was down. They resume mid-stream on stale assumptions and the result is fleet thrash.

The recovery protocol handles this:

1. Boot-time launchd job (`com.wavex-os.recovery-on-boot`, RunAtLoad=true) waits for server health, then fires `POST /api/maintenance/run-recovery-protocol`.
2. Periodic launchd job (`com.wavex-os.recovery-12h`) fires the same endpoint every 12h as a safety net.
3. The recovery service:
   - Probes OAuth health (refreshes via Layer 2 if expired).
   - Runs the attribution sweep (catches issues that closed during outage).
   - Recomputes bottlenecks.
   - Files board approvals for RISKY actions (zombie kills, error-agent restarts).
   - Wakes CEO + CoS with `recoverySnapshotShort` in the wake payload.
4. CEO and CoS follow `SKILL_RECOVERY_PROTOCOL` — they ratify queued approvals and do NOT spawn new delegations on the recovery wake.

---

## Performance optimization layer

Distinct from self-healing: this is the layer that prevents the fleet from burning budget without producing outcomes.

### Per-agent economic self-awareness

Every 15 minutes, the maintenance service writes a personalized `CURRENT_ECONOMICS.md` to each agent's instructions directory containing rank, fleet share %, $/done, $/comment, output:cache verbosity ratio. Agents read this at heartbeat start and obey rules in [`SKILL_ECONOMIC_SELF_AWARENESS`](../packages/standard-skills/SKILL_ECONOMIC_SELF_AWARENESS.md):

- **Verbosity gate.** If output:cache > 0.05, summarize harder.
- **High-burner output gate.** If share > 15% OR $/done > $50, the heartbeat must end with a durable artifact, not a comment.
- **Spinning detection.** If runs ≥ 30 in 24h with 0 closed issues, must close something or escalate.

### Heartbeat rate cap

The wakeup endpoint enforces 6/hr per agent. Direct API path only — automation paths bypass.

### Auto-pause for spinners

`POST /api/maintenance/auto-pause-spinners` (default thresholds: ≥30 runs AND ≤1 done in 24h, excludes role=ceo). Dry-run by default.

### Token budget + throttle

`services/token-budget.ts` computes per-window burn (1h / 5h / 24h / 7d) using model-aware token rates. Configurable thresholds via env (`PAPERCLIP_BUDGET_5H_THROTTLE_CENTS`, `PAPERCLIP_BUDGET_WEEKLY_THROTTLE_CENTS`). Counts wrapper-fallback events to amplify the pressure signal.

The `/api/agents/:id/wakeup` endpoint includes a priority-aware budget gate. Agents are tiered:
- **Tier 1** (CEO, Chief of Staff): always allowed when `wake_reason` matches `/board_directive|recovery_protocol|critical|kpi_breach/i`.
- **Tier 2** (CxO): refused at 5h-throttle.
- **Tier 3** (engineer/pm/devops): refused at weekly-throttle.
- **Tier 4** (researcher/general/qa): refused at 5h-throttle.

The comparison is "refuse if `tier >= refuseAtOrAbove`" — higher tier number = less critical. Easy to invert; we did and had to flip.

### Outcome attribution + bottleneck detection

After each issue closes, `services/outcome-attribution.ts` records forecast vs actual KPI delta in `task_outcome_attributions`. Over time this produces per-agent `accuracyScore` — visible in Mission Control.

`services/bottlenecks.ts` scores KPIs by `gap × (1 + staleness/7) × (1 + downstreamBlockage)`. The Chief of Staff's 4-hour routine reads this list and proposes ONE alignment change per cycle (see `SKILL_FLEET_ALIGNMENT`).

### Mission Control

A live aggregator at `services/mission-control.ts` (60-second server-side cache) feeds a Tailwind div-grid dashboard at `/<COMPANY_PREFIX>/dashboard/mission-control`: goal-progress, bottleneck queue, top burners, spinners.

---

## What we measured

After the kernel + cross-cutting skills + Layer 1–4 self-healing rolled out:

- **96% reduction** in 24h imputed fleet burn (e.g. $514 → $20.42 in one observed window).
- **CEO single-agent burn dropped 95%** (e.g. $194 → $10).
- **Spinner pattern became visible** (≥5 runs / 0 done) and auto-pauseable in one click.
- **OAuth incidents self-resolved** in 2 of 3 cases without user action; the third required a single click on "Refresh OAuth" via mobile.

This was not a clean experimental setup; it's an engineering observation, not a controlled benchmark. But the pattern is consistent enough that we ship it as the default.

---

## What's intentionally NOT included

- The Supabase-deployed Escalation Engine (still WIP upstream; the `wavex.recovery` plugin we built around it produced 311 fallback Telegram alerts in 24h before we disabled it).
- A specific Telegram bridge implementation. The maintenance service exposes a `notifyTelegram(summary)` hook; how you wire that to the actual Telegram API is left to the `wavex.telegram` plugin (vendored separately).
- A specific dashboard visualization library. Mission Control is intentionally Tailwind div-grid — zero JS chart deps.
