# Changelog

All notable changes to WaveX OS are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

Operator-facing CLI hardening. The `wavex-os` command in `@wavex-os/cloud-client` grows a scriptable surface so pairing state, identity, and token health are machine-readable for support and CI.

### Added

- **`wavex-os version` command** — prints the package version; `--json` adds `node` + `platform` so a bug report carries the runtime in one line.
- **`--json` across the CLI** (`version` / `status` / `whoami` / `logout`) — each emits one machine-readable line. `status --json` prints `{"paired":false}` (exit 1) when there is no bundle, otherwise the full pairing record.
- **Token expiry in output** — `status`/`whoami --json` carry both the relative `access_token_expires_in_sec` and the absolute unix `access_token_expires_at`, so a script can show time-left or compare against its own clock. Plain `whoami` shows a time-left hint and a reason when the token is invalid or expired.
- **More identity fields in `--json`** — `token_path` (where the bundle lives), `functions_url` on the unpaired path, and an `access_token_expired` flag on paired `status`/`whoami`.
- **`wavex-os whoami`** — one-line "who is this machine paired as" from the cheap identity call, without a full `status`.
- **Hosted hub url in inference config** (`@wavex-os/inference-adapter`) — surfaced so the tier-router can target a hosted hub.
- **Offline smoke suite** (`packages/cloud-client/scripts/smoke-offline.mjs`) — covers the CLI dispatcher, both `--json` paths, and paired/unpaired bundle states with no network. Package README documents it.
- **Calendar conflict detection** — the calendar-triage runner now flags invites whose time ranges overlap another pending invite, feeds that signal into the recommender prompt, and surfaces `has_conflict` on the approval card. The runner is the only place that sees the whole batch, so the model finally gets the conflict cue it was already prompted to weigh.
- **Graded calendar conflicts** — the runner now also classifies each clash as `hard` (the overlap covers at least half the shorter invite) or `soft` (a tail overlap), passes the grade into the prompt, and writes `conflict_kind` on the approval. The prompt already split decline (hard conflict) from propose-time (soft conflict), so the bare boolean under-informed it; an invite keeps its strongest grade across everything it clashes with.
- **After-hours spill signal** — an invite that starts inside working hours but runs past end-of-day is now flagged `spills_after_hours` on the approval and in the prompt. The inside-hours check only weighed the start, so a 16:30-18:30 meeting against 09:00-17:00 read as a clean accept while it ate 90 minutes of off-hours; the recommender now gets the tail and can lean propose-time. Resolved in the operator's tz like the start check.
- **Privacy zones in the Slack digest** — the slack-digest runner now honours `trust.privacy_zones`, the same as the mail runner: a mention whose channel or author matches a zone is dropped before classification (no inference call, no dashboard card) and logged as `avatar.slack.privacy_skip`. The trust file already declared the field on this runner but nothing read it.
- **VIP floor on Slack mentions** — a VIP author's direct ping can no longer sink to `fyi` (the bottom bucket) on classifier drift: it's floored back up to `urgent` after classification, deterministically. A broadcast (`@everyone` / `@channel` / `@here`) is left alone, the Slack equivalent of the mail runner's "unless transactional" VIP carve-out. The prompt already favoured VIPs, but nothing caught the model when it didn't.
- **Broadcast ceiling on Slack mentions** — the mirror of the VIP floor: a non-VIP `@everyone`/`@channel`/`@here` blast classified `urgent` is capped down to `info`, since a message to the whole channel is never a personal urgent ask and would otherwise bury a real direct ping. A VIP's broadcast keeps its rating, the same trust-file carve-out the floor makes.
- **Bounce mailboxes count as no-reply** — the mail runner's no-reply guard now also flags `bounce@`/`bounces@` return-path senders, the addresses ESPs put on automated mail. A drafted reply there vanishes the same as one to `mailer-daemon@`, so the operator gets the skip cue. `bouncer@` and other words that merely contain "bounce" are left alone.
- **VERP bounce addresses too** — the bounce check now also catches the per-recipient return paths ESPs actually use, `bounces+SRS=token@`, `bounce+SRS=token@` (the singular form Amazon SES sends) and `bounce-12345@`, not just the bare `bounce@`/`bounces@`. A plus-tagged or numbered bounce or a `bounces*` prefix flags; `bouncer@` stays human.
- **Deterministic VIP flag on mail drafts** — the mail-triage runner now matches the sender against `trust.vips` itself (exact, case-insensitive) and writes `fromVip` + `vipLabel` onto the approval, instead of leaving "this is a VIP" buried in the model's reasoning prose where the card can't trust it. When the sender is a known VIP the classifier prompt also names it outright rather than handing over the whole table and hoping the model spots the match — the same VIP carve-out the Slack floor makes, surfaced one layer earlier.
- **No-reply senders flagged on mail drafts** — the mail-triage runner now sets `noReply` on the approval when the sender's local-part looks automated (`noreply@`, `no-reply@`, `do-not-reply@`, `mailer-daemon@`, `postmaster@`, separators ignored). A reply to one of these bounces or vanishes, so the card can warn before the operator approves a draft into a void. Matched deterministically, the same as the VIP flag, rather than trusting the model to notice.
- **Thread dedup on Slack mentions** — repeated @-mentions in one thread now collapse to a single card. Slack reports every mention separately, so an operator pinged three times in one back-and-forth used to get three dashboard cards and three inference calls for one conversation. The digest keeps one mention per `threadTs` — the most recent, the current state of the ask — before classification; unthreaded mentions are untouched. The `threadTs` field was already on the runner's mention shape but nothing read it.

### Fixed

- **License hygiene** — `LICENSE` truncated to canonical Apache-2.0, `NOTICE` added, and the community README badge corrected MIT → Apache-2.0. `CODE_OF_CONDUCT` added and linked from `CONTRIBUTING`.
- **WCAG touch target** — the `+ New` link padded to a 44px minimum so it meets the tap-target guideline.
- **Avatar triage robustness** — the slack-digest, mail-triage, and calendar-triage runners coerce the model's raw JSON to the allowed enum and a `[0,1]` confidence before writing an approval, so a drifted `"critical"` importance or a `1.5` confidence can't reach the dashboard. The calendar runner also drops `proposed_times` entries that don't parse as a datetime, so an `"any time Tuesday"` answer can't reach the RSVP path as a sendable slot.
- **Calendar working-hours honor the operator's tz** — the inside/outside-hours signal read the start hour off UTC and ignored `profile.tz`, so a 16:00 Los Angeles invite resolved to 23:00 and looked after-hours to the recommender. It now resolves the start on the operator's wall clock and falls back to UTC only when the tz is unknown.

---

## [0.3.0] — 2026-05-12

Clean-slate V2 rebuild. Backports five weeks of production-fleet learnings into agent templates and adds the monetization + reliability layers. Full manifest: [docs/V2_MANIFEST.md](docs/V2_MANIFEST.md).

### Added

- **Universal kernel rule** (`_shared/SKILL_VERIFY_BEFORE_CLAIM`) — every agent must include an independent verification probe in any "sent/deployed/applied/live" claim. Enforced by a 10-min sweeper with auto-revert. Closes the SDK-returns-lie failure mode.
- **5 kernel lessons** (`_shared/SKILL_KERNEL_LESSONS`) — CEO + CoS read these every cycle: SDK returns aren't delivery, forecasted deltas are inflated (require N≥3), migrations are half the work, OVERRIDE prefixes trip prompt-injection defenses, internal traffic looks like organic until you split it.
- **WAV-6388 measurement contract** (`ceo/SKILL_KPI_OWNERSHIP`) — every issue needs `target_kpi` + `estimated_delta` + `measurement_plan` + `baseline_snapshot`. Missing any → auto-F grade.
- **Role collapse** (`_shared/SKILL_ROLE_COLLAPSE`) — wizard picks roster shape by Pillar 3 stage: `minimal_kernel` (pre_product) → `collapsed_6` → `hybrid` → `formal_9`. Solo founders get a further-collapsed 5-agent kernel.
- **Ignition phase** (`packages/wavex-os-server/src/bridge/ignition.ts`) — after activate, the fleet boots itself: seeds first-task issues from `workflow_manifest`, creates the Goal, fires CEO + CoS kickoff probe, staggers heartbeat offsets. Idempotent re-run via `POST /api/instance/:id/ignite`.
- **System Reliability agent** (`system-reliability/SKILL`) — new role in every V2 fleet. Owns disk + RAM + inference burn as KPIs. Calls `paperclipai worktree:cleanup` (never raw `rm`). Pages operator via Telegram on RED.
- **15-min resource sweep** (`scripts/wrappers/resource-sweep.sh`) — platform-level launchd job, runs even when fleet is paused. Prunes reproducible artifacts at 70% disk, throttles spawns at 80%, pages operator at 90%.
- **Stripe + Supabase billing** — `wavex_os` Postgres schema + Stripe products + `stripe-webhook` + `create-checkout-session` edge functions + `/pricing` route with inline Supabase magic-link sign-in.
- **Mac-as-inference-server scaffold** (`packages/inference-server/`) — Fastify on :8787 + cloudflared tunnel to `api.wavex-os.com`.
- **`wavex-os audit` CLI** — `node apps/installer/bin/init.js audit` checks disk, RAM, ports, launchd jobs, service health in one shot.
- **Operator-facing Meta Mission Control** (`admin/`) — single-page Fastify+HTML dashboard to see all customer subscriptions, optimizer runs, pending injections. Hand-rolled JWT auth.
- **`@wavex-os/db` package** — PGlite (dev) / Postgres (prod) backend with Drizzle ORM schema, migrations, and a smoke test suite.
- **`@wavex-os/wavex-os-server` package** — Fastify routes for the vendored onboarding plugin, activation bridge, and ignition.
- **`@wavex-os/inference-adapter` package** — tier-router `claudeBin` source (`WAVEX_INFERENCE_MODE: oauth/apikey`).
- **`@wavex-os/auth-shim` package** — `assertBoard` / `assertCompanyAccess` gates (`WAVEX_AUTH_MODE`).
- **`@wavex-os/composio-shim` package** — `listConnections` + featured toolkits (`WAVEX_COMPOSIO_DISABLED`).
- **Vendored wavex-os plugin** (`vendor/wavex-os/`) — onboarding, tier-router, flywheel-kernel, flow-types packages vendored at `d84983a1`.
- **GitHub Actions CI** (`.github/workflows/ci.yml`) — runs install + vendored build + tests + type checks on every push to `main` and every PR.

---

## [0.2.0] — 2026-04 (Phase H)

Minimal inception kernel + four-layer self-healing. Production patterns from a 7-day deployment crystallized into open-source skills, services, and operational templates.

### Added

- Paperclip handoff bridge (Phase D) — activate step hires C-Suite as real Paperclip agents.
- Four-layer self-healing (`packages/healing/`) — OAuth refresh, worker restart, 401 fallback, and operator page.
- Observability package (`packages/observability/`) — bottlenecks, attribution, token budget.
- Fleet burn reduced 96% vs baseline; single-agent burn reduced 95%.

---

[0.3.0]: https://github.com/aimerdoux/wavex-os/releases/tag/v0.3
[0.2.0]: https://github.com/aimerdoux/wavex-os/releases/tag/v0.2
