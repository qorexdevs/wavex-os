# WaveX OS — Roadmap

> Public delivery plan. Phases are sequential — no Phase N+1 work begins until Phase N is verified working end-to-end. See [ARCHITECTURE.md](./ARCHITECTURE.md) for the technical spec.

---

## ✅ Phase A — Public repo + curated templates

- [x] Public GitHub repo at [github.com/aimerdoux/wavex-os](https://github.com/aimerdoux/wavex-os) (MIT)
- [x] Paperclip vendored via git subtree at `packages/core/`
- [x] 30 agent templates ingested from `agency-agents` + WaveX-authored
- [x] `_registry.json` + per-template attribution headers
- [x] Hardened `.gitignore`, `LICENSE`, `README.md`, `CREDITS.md`
- [x] PII scrub of all templates before push

---

## ✅ Phase B — Installer + onboarding UI scaffold

- [x] pnpm workspace setup (`packages/*`, `apps/*`)
- [x] `apps/installer/` — `npx wavex-os init` CLI scaffold (doctor + scaffold session)
- [x] `packages/onboarding-ui/` — Vite + React 18 + TypeScript
- [x] All 11 wizard pages stubbed and rendering
- [x] Shared layout, navigation, zustand-persisted state
- [x] `packages/onboarding-server-client/` — typed stub
- [x] `docs/ARCHITECTURE.md` + `docs/ROADMAP.md`
- [x] Browser-tested end-to-end (smoke: vite serves all 11 routes, prod build clean)

---

## 🚧 Phase C — Local backend integration

- [x] Vite proxies `/api/paperclip/*` → `http://127.0.0.1:3100/api/*` (wired)
- [x] Registry available to UI (`src/data/templates.ts`, lazy-loadable skills under `/public/agent-templates`)
- [x] Step 4 (org-design) — interactive `reactflow` graph (3-tier layout, drag, zoom)
- [x] Step 5 (template-picker) — click → modal with skill markdown, KPIs, origin badge
- [x] Step 6 (KPI ownership) — auto-populated from primary goal + template defaults
- [ ] Mock Paperclip core for onboarding-time spawn (stub heartbeat scheduler, fake agent rows)
- [ ] Installer boots mock core alongside Vite UI (concurrent process supervisor)
- [ ] Step 9 (spawn) — SSE stream wired to mock core
- [ ] Manifest → mock-core agent rows persisted to disk
- [ ] Real Paperclip core integration (replace mock — Phase D)

**Exit:** clone → `npx wavex-os init` → onboard → reach Mission Control with mock fleet running.

---

## Phase D — Hosted onboarding inference

- [ ] `api.wavex-os.com` deployed (Cloudflare Workers? Vercel? Decide.)
- [ ] `POST /v1/onboarding/sessions` — creates session, returns ID
- [ ] `POST /v1/onboarding/sessions/:sid/inference` — proxies to Anthropic with our key
- [ ] Per-session 30K-token soft cap (returns 429 when exceeded)
- [ ] Step 7 (customize-chat) wired to hosted inference
- [ ] Rate limiting, abuse detection, IP-level caps

**Exit:** new user can run customize-chat without bringing their own API key.

---

## Phase E — Claude Max OAuth handoff

- [ ] `claude-anthropic-direct.sh` wrapper (macOS keychain reader, with refresh + fallback)
- [ ] Linux equivalent (`secret-tool`) and Windows equivalent (`cmdkey`)
- [ ] Per-agent symlink wiring during spawn
- [ ] Step 10 (handoff) — real probe + smoke heartbeat
- [ ] Adapter config that points all spawned agents at the wrapper

**Exit:** the spawned fleet runs entirely on the user's Claude Max plan; no Anthropic key needed in the repo or in any user-facing config.

---

## Phase F — System Optimizer + subscriptions

- [ ] Stripe integration for tier purchase
- [ ] Cloud cron pulls KPI digest from each subscriber's Paperclip API (ngrok-tunneled)
- [ ] Optimizer prompt template (board-level injection, not micromanagement)
- [ ] CEO/CoS receive injection as a comment on a "System Optimizer" parent issue
- [ ] Self-host path: `wavex-os-optimizer` Docker image (BYO-key)
- [ ] Step 11 (subscription) wired to real Stripe checkout

**Exit:** paying customer gets a daily/hourly board injection that visibly improves fleet decisions.

---

## 🚧 Phase G — Mission Control v2 (post-onboarding)

- [x] Root route `/` renders a real Mission Control dashboard (replaces App.tsx placeholder)
- [x] Top bar with WaveX OS brand, live core health strip (5s polling), re-onboard link
- [x] KPI scoreboard (primary goal card with progress bar + supporting KPIs from templates)
- [x] Live fleet graph (reactflow, polls `/api/paperclip/agents` every 8s, status dots per agent)
- [x] Empty-state UX (prompts onboarding when no fleet present)
- [ ] KPI sparkline trends (Phase G continuation)
- [ ] Drag-drop agent reassign + persist back to mock-core
- [ ] Workflows queue (issues by status, filterable) — needs real Paperclip core
- [ ] Approvals tray (board approvals routed to Telegram + UI)
- [ ] Workspace tray (live ngrok status, Composio connector health, etc.)

**Exit:** the dashboard replaces the Paperclip Maintenance UI for WaveX OS users.

---

## ✅ Phase H — Minimal inception kernel + four-layer self-healing (v0.2.0)

Production patterns from a 7-day WaveX deployment crystallized into open-source skills, services, and operational templates. Responsible for a 96% drop in 24h imputed fleet burn during the rollout that produced this release.

- [x] **H1**: Standard cross-cutting skills (`packages/standard-skills/`)
  - SKILL_ECONOMIC_SELF_AWARENESS, SKILL_VERIFY_BEFORE_CLAIM, SKILL_KPI_OWNERSHIP, SKILL_HARNESS_RECOGNITION, SKILL_LESSONS_READ, SKILL_DELEGATE_OR_KILL
  - Chief of Staff playbooks (SKILL_FLEET_ALIGNMENT, SKILL_RECOVERY_PROTOCOL)
  - `docs/MINIMAL_INCEPTION.md` topology spec, `docs/SELF_HEALING.md` architecture
- [x] **H2**: Self-healing reference impl (`packages/healing/`)
  - OAuth refresh with concurrency lock (in-flight Promise singleton + 30s cooldown + invalid_grant retry)
  - Worker restart (SIGTERM → 10s grace → SIGKILL → retry hook)
  - Per-spawn execution wrapper (`scripts/wrappers/claude-spawn.sh`) with 401 self-heal + Sonnet fallback on rate-limit
- [x] **H3**: Observability reference impl (`packages/observability/`)
  - Bottleneck scoring, outcome attribution, token budget + priority-aware throttle
  - Mission-control aggregator (60s cache), fleet-observer markdown synthesis
  - Pluggable `DbExecutor`, role tier map, KPI dependency map
- [x] **H4**: Launchd templates + provisioning scripts (`templates/launchd/`, `scripts/`)
  - Six `.plist.tmpl` files with `${COMPANY_ID}/${API_BASE}/${STATE_DIR}` placeholders
  - `render-launchd-templates.mjs`, `provision-chief-of-staff.sample.mjs`, `setup-hierarchy-and-kpis.sample.mjs`
  - Generic KPI registry example (revenue_target_30d, qualified_leads_7d, conversion_rate_7d, etc.)
- [x] **H5**: Doc polish (this file, README, SECURITY)

**Exit:** clone → `pnpm install` → fill `wavex-os.config.json` → `node scripts/render-launchd-templates.mjs && node scripts/provision-chief-of-staff.sample.mjs && node scripts/setup-hierarchy-and-kpis.sample.mjs` → kernel + recovery routines running on a Paperclip-backed deployment.

---

## Beyond Phase G

- Multi-fleet support (one user, multiple companies)
- Composable templates marketplace (community-contributed agents under MIT)
- Time-decayed past-decision retrieval (RAG over closed-issue comment trees)
- Mobile companion app (read-only KPI / approval inbox)
- Replacement for `_shared/INCEPTION_KNOWLEDGE.md` with role-sliced bundles (research only — see `velvety-soaring-newt` plan)

---

## Cadence + decision rules

- **Each phase ships behind a single git tag** (`v0.1.0-phase-b`, `v0.2.0-phase-c`, …).
- **Each phase has one "exit criterion"** — measurable, testable, written above. We do not begin Phase N+1 until N is shipping for at least one real user.
- **Subtractive over additive**: if a feature isn't pulling its weight after one phase, it gets cut.
- **Open-source before optimization**: every phase is shippable as open-source. Subscription tiers (Phase F) only add hosted convenience.
