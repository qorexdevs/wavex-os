# Changelog

All notable changes to WaveX OS are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
