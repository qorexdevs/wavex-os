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

## 🚧 Phase B — Installer + onboarding UI scaffold

- [x] pnpm workspace setup (`packages/*`, `apps/*`)
- [x] `apps/installer/` — `npx wavex-os init` CLI scaffold (doctor + scaffold session)
- [x] `packages/onboarding-ui/` — Vite + React 18 + TypeScript
- [x] All 11 wizard pages stubbed and rendering
- [x] Shared layout, navigation, zustand-persisted state
- [x] `packages/onboarding-server-client/` — typed stub
- [x] `docs/ARCHITECTURE.md` + `docs/ROADMAP.md`
- [ ] Browser-tested end-to-end (Phase B exit criterion)

---

## Phase C — Local backend integration

- [ ] Installer boots Paperclip server alongside Vite UI (concurrent process supervisor)
- [ ] Vite proxies `/api/paperclip/*` → `http://127.0.0.1:3100/api/*` (already wired)
- [ ] Step 6 (KPI ownership) — drag-drop driven by templates' `defaultOwnedKpis`
- [ ] Step 4 (org-design) — interactive force-directed graph via `reactflow`
- [ ] Step 5 (template-picker) — click → modal showing skill content, KPIs, connectors
- [ ] Step 9 (spawn) — SSE stream from Paperclip's heartbeat scheduler showing real spawn progress
- [ ] Manifest → Drizzle migration → agent table population

**Exit:** clone → `npx wavex-os init` → onboard → real agents in `~/.wavex-os/instances/<company>/agents/`.

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

## Phase G — Mission Control v2 (post-onboarding)

- [ ] After step 11, route `/` to a Mission Control dashboard
- [ ] KPI scoreboard (live, with sparkline trend per supporting KPI)
- [ ] Agent org graph (reactflow, drag-drop reassign)
- [ ] Workflows queue (issues by status, filterable)
- [ ] Approvals tray (board approvals routed to Telegram + UI)
- [ ] Workspace tray (live ngrok status, Composio connector health, etc.)

**Exit:** the dashboard replaces the Paperclip Maintenance UI for WaveX OS users.

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
