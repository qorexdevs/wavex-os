# Wavex-Os Onboarding Migration Plan — Full-Fidelity Integration into wavex-os

**Status:** planning · **Source of truth:** operator-omega `packages/plugins/onboarding/` + `server/src/{routes,services}/` + `ui/src/{pages,components,lib}/wavex-os/onboarding/`

## Preamble — diagnosis

Wavex-os's onboarding implementation is **~23,000 LOC across 100+ files**, including production-validated server-side pipeline (12,100 LOC plugin + 2,414 LOC server routes/services), comprehensive UI (4,687 LOC components), and rigorous testing (~7,000 LOC differential-equation suite + harness). The local integration branch (`feat/wavex-os-onboarding`) currently contains **3,240 LOC** of wavex-os-shaped code — roughly 14% of the source-of-truth size.

The previous attempts simplified along architectural axes that the user has now rejected:

| Wavex-os Feature | Source LOC | Local LOC | Status |
|---|---|---|---|
| Pillar 1 enrichment (10 inferred fields, T2 enrichment, Pillar1InferencePreview confirm/correct) | 369 + 150 | 116 (single component, 5 fields, no preview) | **Lost** |
| Phase 2 Connector (decision-matrix + T2 refinement + Composio fold-in + bootstrap flow) | 1,014 LOC + 558 LOC UI | 87 + 45 LOC UI | **Lost** |
| Phase 3 Swarm (BASE_ROSTER, 35+ predicates, credential-gated activation, T2 skill_overlay polishing) | 1,043 LOC + 509 LOC SwarmOrgChart | 91 + 54 LOC text table | **Lost** |
| Phase 4 Workflow (templates, bundle allocation, T2 task mutation, budget enforcement) | 792 LOC | 96 LOC | **Lost** |
| Finalize: Monte Carlo simulator + Imprint Review | 458 LOC | 137 LOC (no MC, no imprint) | **Lost** |
| Credential Concierge (state machine: bootstrap + direct + paste/skip/validate flows) | 491 LOC service + 577 LOC UI | None | **Lost** |
| Credential Registry (per-credential definitions, validators, sample tests) | 382 LOC | None | **Lost** |
| Credential Vault (Drizzle-backed audit log, multi-actor writers) | 353 LOC | 149 LOC filesystem-only | **Degraded** |
| Composio integration (live connection state folding, bootstrap key flow, oauth handshake) | Full @composio/core integration | None | **Lost** |
| Better-Auth gates (assertBoard, assertCompanyAccess) | Every route | None | **Lost** |
| Tier-router (T2 multi-tier with rate-limit budgeting) | Full @wavex-os/plugin-tier-router | Direct claude CLI | **Degraded** |
| Pillar transition T0 hints (inter-pillar option modifications) | 102 LOC | None | **Lost** |
| KPI Verification (3-tier progressive disclosure) | 309 LOC | None | **Lost** |
| Tuning Registry (50+ @tunable annotations + print-map + print-chart) | 612 LOC | None | **Lost** |
| Differential equation suite + validation matrix + baseline capture | ~7,000 LOC | 9 vitest + 5 e2e fixtures | **Lost** |
| Manifest YAML output, signing with manifest_hash + signatures | YAML + JSON, manifest_hash, generated_by_* | JSON-only, sha256 | **Degraded** |

**Estimated effort to reach full fidelity:** 4–6 focused engineering weeks. The remainder of this document specifies how.

---

## PHASE 1 — System Understanding

### 1.1 Wavex-Os architecture (source of truth)

**Layer 1 — Plugin (`packages/plugins/onboarding/`, ~12,100 LOC):**
- DB-free pure pipeline: pillar handlers → phase generators → finalize → assembled `CompanyManifest`
- Filesystem-only persistence: `~/.paperclip/instances/default/companies/{companyId}/onboarding/`
- T2 inference via `@wavex-os/plugin-tier-router`
- KPI snapshots + Monte Carlo via `@wavex-os/plugin-flywheel-kernel`
- Plugin SDK: `@paperclipai/plugin-sdk`

**Layer 2 — Server (`server/src/`, ~2,414 LOC):**
- Express routes: `routes/wavex-os-onboarding.ts` (1,188 LOC, 24 endpoints)
- Auth gate on every route: `assertBoard(req)` + `assertCompanyAccess(req, companyId)` via Better-Auth
- Drizzle ORM tables: `companies`, `agents`, `credentials`, `credentialAuditLog`
- Services: `credentialVault.ts` (353 LOC), `credentialConcierge.ts` (491 LOC), `credentialRegistry.ts` (382 LOC)
- Composio integration: `lib/composio/client.ts`

**Layer 3 — UI (`ui/src/`, ~5,385 LOC):**
- Host: `pages/WavexOsOnboarding.tsx` (655 LOC) — Phase state machine with 14 phase values, manifest cache, draft-inflight idempotency, dev-mode escape hatch
- Components (25 files, 4,687 LOC): Pillar1-5, Pillar1InferencePreview, Phase2ConnectorStep (558 LOC), CredentialConciergeStep (577 LOC), SwarmOrgChart (509 LOC), KPIVerification (309 LOC), materialize-phase (308 LOC), halt-screen, etc.
- API client: `lib/wavexOsOnboarding.ts` (428 LOC)
- Helpers: `lib/{onboarding-draft, onboarding-route, onboarding-launch, onboarding-goal}.ts` (270 LOC)

**Hard dependencies:**
- `@wavex-os/plugin-tier-router` — T2 inference router (multi-tier, rate-limit budgeting)
- `@wavex-os/plugin-flywheel-kernel` — KPI snapshots, MC engine, bundle allocation
- `@paperclipai/db` — Drizzle ORM tables (companies, agents, credentials, credentialAuditLog, ...)
- `@paperclipai/plugin-sdk` — Plugin manifest + health
- `better-auth` — OAuth flows, assertBoard, assertCompanyAccess
- `@composio/core` — Toolkit OAuth + live connection state
- `js-yaml` — Manifest YAML output
- `drizzle-orm` — Type-safe DB queries
- `react-router`, `@tanstack/react-query`

### 1.2 Minimal Flywheel architecture (integration target)

**Layer 1 — Healing (`packages/healing/`, 306 LOC):**
- `oauth-refresh.ts` — Anthropic OAuth refresh with concurrency lock (in-flight Promise coalesce + 30s cooldown + invalid_grant retry); reads/writes macOS keychain via `security` CLI
- `worker-restart.ts` — `pgrep`-based discovery, SIGTERM + 10s wait + SIGKILL stragglers; pre-flight OAuth check + `force_through_bad_auth` flag

**Layer 2 — Observability (`packages/observability/`, ~1,100 LOC):**
- Postgres-backed (lazy-loaded `drizzle-orm`)
- Required tables: `company_kpis`, `kpi_snapshots`, `cost_events`, `issues`, `agents`, `heartbeat_runs`, `task_outcome_attributions`, `issue_comments`
- `token-budget.ts` (289 LOC) — per-window burn (1h/5h/24h/7d) with priority throttle; reads NDJSON `~/.wavex-os/state/wrapper-fallback-logs/fallback.ndjson`
- `mission-control.ts` (225 LOC) — dashboard aggregator (60s cache), spinners detection (≥5 runs + 0 done in 24h)
- `bottlenecks.ts` (177 LOC) — KPI scoring: gap × staleness × downstreamBlockage
- `outcome-attribution.ts` — post-issue-close forecast vs actual KPI delta
- `fleet-observer.ts` — Markdown report synthesizer for Chief of Staff

**Layer 3 — Standard skills (`packages/standard-skills/`, 6 .md files):**
- Cross-cutting: KPI_OWNERSHIP, ECONOMIC_SELF_AWARENESS, DELEGATE_OR_KILL, VERIFY_BEFORE_CLAIM, LESSONS_READ, HARNESS_RECOGNITION
- Chief-of-staff specific: SKILL_FLEET_ALIGNMENT (4h routine), SKILL_RECOVERY_PROTOCOL

**Layer 4 — Provisioning (`scripts/`, 695 LOC + `templates/launchd/`, 6 jobs):**
- `claude-spawn.sh` — Layer 1 wrapper: live keychain read on every spawn; usage-limit fallback to Sonnet; 401 → /api/maintenance/oauth/refresh → re-exec same model
- `claude-anthropic-direct.sh` — `probe`/`exec` subcommands (env > stub > keychain credential resolution)
- `render-launchd-templates.mjs` — substitutes `${COMPANY_ID}`, `${API_BASE}`, `${STATE_DIR}` into 6 plist templates (recovery-on-boot, recovery-12h, fleet-assessment, economics-refresh, attribution-sweep, bottleneck-digest)
- `provision-chief-of-staff.sample.mjs` — Drizzle insert for chief_of_staff agent + skill distribution
- `setup-hierarchy-and-kpis.sample.mjs` — KPI registry → company_kpis upsert; topology validation (single root, owner-tree integrity)

**Filesystem contract (`~/.wavex-os/instances/<companyId>/`):**
- `session.json` — installer-written, untouched
- `agents.json` — wavex AgentRecord shape, runtime + dashboard read this
- `kpi-registry.json` — matches `examples/kpi-registry.example.json`
- `wavex-os.config.json` — matches `examples/wavex-os.config.example.json`

**Infrastructure assumptions:**
- Postgres with all tables created (no schema migrations bundled; runtime expects them to exist)
- macOS keychain ("Claude Code-credentials" service, OAuth envelope `{accessToken, refreshToken, expiresAt}`)
- Claude CLI on PATH or `WAVEX_CLAUDE_BIN`
- Orchestrator API at `WAVEX_API_BASE` (default `http://127.0.0.1:3100`)
- macOS launchd for job scheduling

### 1.3 Local integration branch architecture (current state)

**Layer 1 — `packages/wavex-os-onboarding/` (2,177 LOC):**
- Filesystem-backed (no Drizzle, no Postgres)
- Pillar handlers (5, ~312 LOC vs wavex-os's 906); deterministic-only for 3-5; Pillar 1 has Claude direct call (no T2 router)
- Decision modules (`decision/`, 244 LOC vs wavex-os's 1,014+1,043+792 = 2,849)
- No flywheel-kernel (no Monte Carlo); no imprint review
- Vault: filesystem-backed (149 LOC vs wavex-os's 353); no concierge state machine; no registry
- Inference: `inference/claude-cli.ts` (133 LOC) — direct `claude -p` spawn; no tier router

**Layer 2 — `packages/onboarding-ui/src/wavex-os/` (1,063 LOC):**
- `WavexOsOnboarding.tsx` (159 LOC vs wavex-os 655) — host shell + Phase state combined; no manifest cache; no draft-inflight; no dev escape hatch
- Pillar components (5, 499 LOC vs wavex-os 855+150 InferencePreview+237 phase1-host)
- Phase components (4, 219 LOC vs wavex-os 558+509+128+308 = 1,503 just for these)
- No Pillar1InferencePreview, no Phase2ConnectorStep (just text rendering), no SwarmOrgChart, no CredentialConcierge UI, no KPIVerification 3-tier, no progressive materialize polling

**Layer 3 — Mock-core integration:**
- `mock-core/src/server.ts` registers `registerWavexOsRoutes(app)` (the package's Fastify routes)
- Native runtime endpoints: /api/health, /api/agents, /api/spawn (mock), /api/instance/:companyId/{manifest,kpis,events}
- No Postgres (filesystem only)

**Test coverage:**
- 9 vitest unit tests (projection + finalize integration)
- 5 fixture companies in Playwright e2e
- vs wavex-os's 4-suite differential-equation framework + validation matrix + baseline capture (~7,000 LOC)

### 1.4 Onboarding flow diagrams

**Wavex-os original (verbatim production flow):**

```
Operator visits /omega-onboarding
  ↓ GET /wavex-os/onboarding/status (Better-Auth gated; reads pillar_responses.json)
  → Routes UI to Phase based on next_pillar OR has_*_manifest

PHASE 1: Pillars 1-5
  ↓ Each pillar:
    1. Operator submits via POST /wavex-os/onboarding/pillar/<N>
    2. (Pillar 1 only) tier-router T2 enrichment of org context (10 fields) — UI also shows Pillar1InferencePreview
    3. (Pillar 2) probeClaudeCode() + deriveInferenceBudgetProfile()
    4. (Pillars 3-5) deterministic + minor T2 hints
    5. updatePillar() under per-companyId mutex
    6. runPillarTransition() generates next-pillar option modifications
    7. Server returns Pillar<N>Response + next_pillar

PHASE 2: Connector Manifest
  ↓ Operator clicks "Generate Connector Manifest"
    1. POST /wavex-os/onboarding/generate/connector
    2. runDecisionMatrix(pillar_responses) — T0 baseline (16 connector IDs, P-1/P0/P1/P2 priorities)
    3. tier-router T2 refinement of rationales (skipInference flag bypasses)
    4. Fold liveConnections from Composio (status: configured/pending_credential/pending_decision)
    5. writeArtifact() → connector_manifest.yaml + .json + hash
    6. Return manifest + source ("t2" or "fallback")

PHASE 2B: Credential Concierge
  ↓ POST /wavex-os/onboarding/credential-concierge/init
    1. credentialConcierge.deriveRequiredCredentials() reads connector_manifest
    2. Maps connectors → credential keys (composio bootstrap + direct: supabase×2, github×1, mixpanel×1, stripe deferred)
    3. CredentialOnboardingState persisted to credential-state.json
  ↓ Per-credential operator interaction:
    - paste → vault.writeCredential(encrypted) + audit log + slot → "pasted"
    - validate → vault.readCredential() + credentialRegistry.runValidator() + updateValidationStatus → "valid"
    - skip → slot → "skipped"
  ↓ POST /wavex-os/onboarding/credential-concierge/finalize → canFinalize: true

PHASE 3: Swarm Manifest
  ↓ POST /wavex-os/onboarding/generate/swarm
    1. Load pillar_responses + connector_manifest + credential vault state
    2. runSwarmDecisionMatrix(): start with BASE_ROSTER (5), evaluate 35+ activation_rules per agent against credential gates
    3. Agents with skipped/invalid credentials → parked + unpark_reason recorded (F4 invariant)
    4. tier-router T2 polishing of skill_overlay only (status, unpark_reason cannot flip per F4)
    5. writeArtifact() → swarm_manifest.yaml + .json

PHASE 4: Workflow Manifest
  ↓ POST /wavex-os/onboarding/generate/workflow
    1. Load pillar_responses + swarm_manifest
    2. runWorkflowDecisionMatrix(): templates per agent + stage → bundle allocation L0/L1
    3. Budget enforcement: sum(workflow tokens) vs claude_plan budget; HALT if over (bypassBudgetCheck flag overrides)
    4. tier-router T2 task mutation + rationale markers (no structural changes per F6)
    5. writeArtifact() → workflow_manifest.yaml + .json

PRE-FINALIZE: KPI Verification
  ↓ POST /wavex-os/onboarding/kpi/verify (KPIVerification.tsx, 3-tier progressive disclosure)
    1. Operator inputs/verifies: MRR, NRR, CAC, burn_multiple, etc.
    2. Validates ranges
    3. Merges into QA snapshot (NOT into pillar_responses.json)

FINALIZE
  ↓ POST /wavex-os/onboarding/generate/finalize
    1. invokeMonteCarlo(): flywheel-kernel runs 30 cycles × 30 runs (seed 42); returns MonteCarloWinner (strategy_id, sharpe, metrics, rationale) — DETERMINISTIC, no T2
    2. tier-router T2 imprint review (optional skip): summarizes operator playbook
    3. assembleCompanyManifest(): embeds all 4 manifests + MC winner + imprint + credential metadata
    4. Compute manifest_hash (sha256 of unsigned canonical body)
    5. Add signatures: {generated_by_operator, generated_by_system, manifest_hash}
    6. writeArtifact() → company.manifest.yaml + .json
    7. Update pillar_responses.completed_at = now

MATERIALIZATION (Phase 5+, post-finalize)
  ↓ POST /wavex-os/onboarding/materialize
    1. Load company.manifest.json
    2. For each agent (status="active") in swarm_manifest: insert into agents table
    3. Return created agents
  ↓ GET /wavex-os/onboarding/status returns materialize state
```

**Local branch flow (current, simplified):**

Same shape, but:
- No tier-router T2 anywhere except Pillar 1 enrichment (direct Claude CLI)
- No Composio fold-in (Phase 2 is deterministic only)
- No credential-gated activation (Phase 3 has 7 predicates instead of 35+)
- No budget enforcement (Phase 4)
- No Monte Carlo (Finalize)
- No imprint review
- No CredentialConcierge state machine
- No KPI verification 3-tier UI
- No pillar transition hints
- No manifest cache (back-nav loses state)
- No draft-inflight idempotency

### 1.5 State lifecycle analysis

**Wavex-os persistence:**
- `pillar_responses.json` — mutable draft, written under per-companyId mutex (atomic tmp+rename)
- `{connector,swarm,workflow}_manifest.{json,yaml}` — written by phase generators
- `company.manifest.{json,yaml}` — signed final
- `credential-state.json` — concierge state machine
- `credentials/` — encrypted blobs (or DB rows in `credentials` table when DB-backed)
- `credentialAuditLog` table — append-only audit
- `companies` table — company metadata (renamed if Pillar 1 detects stub-name pattern)
- `agents` table — created at materialize

**Local persistence:**
- Same files as wavex-os EXCEPT:
- No DB tables (everything filesystem)
- No `credentials` Drizzle table — uses `vault/store.ts` + `vault/audit.ts` (filesystem)
- No `agents` table — runtime reads `agents.json` directly

**State conflict:** the runtime layer (`packages/observability/`) expects DB tables (`agents`, `kpi_snapshots`, etc.). Local branch sidesteps this by having mock-core read from `agents.json` for `/api/agents`, but observability's `getMissionControl()` and `computeBottlenecks()` cannot run because their SQL queries require Postgres + the table schemas. **This is a critical architectural conflict** — the dashboard works in degraded mode (no observability data flow) but the system cannot self-heal/observe in production state without the database.

### 1.6 Shared vs isolated systems

| System | Shared/Isolated | Where |
|---|---|---|
| Filesystem `~/.wavex-os/instances/<companyId>/` | Shared between onboarding (writes) + runtime (reads) | All branches |
| Postgres DB | Shared between wavex-os services + minimal flywheel observability | Wavex-os + minimal flywheel; **absent from local** |
| macOS keychain "Claude Code-credentials" | Shared between healing + spawn wrappers + Pillar 2 probe | All branches |
| Launchd jobs | Isolated per-company (rendered from templates) | Minimal flywheel (templates exist, runtime registers) |
| Mock-core in-memory state | Isolated (single process) | Local only |
| Wavex-os plugin SDK lifecycle | Wavex-os only | Source of truth |
| Composio API | Shared per-company (vault key isolation) | Wavex-os only |

### 1.7 Critical dependencies map

```
Wavex-os onboarding pipeline
  ├── @paperclipai/db ────────────► Postgres (companies, agents, credentials, credentialAuditLog, ...)
  ├── @paperclipai/plugin-sdk ────► plugin manifest, health
  ├── @wavex-os/plugin-tier-router ► T2 router (multi-tier, rate-limit, prompt-version registry)
  ├── @wavex-os/plugin-flywheel-kernel
  │     ├── KPI snapshot model
  │     ├── Monte Carlo engine
  │     └── Bundle allocation calculator
  ├── better-auth ────────────────► assertBoard, assertCompanyAccess (multi-user)
  ├── @composio/core ─────────────► toolkit OAuth + live connection state
  ├── js-yaml ────────────────────► YAML manifest output
  └── drizzle-orm ────────────────► Type-safe DB queries

UI:
  ├── @tanstack/react-query
  ├── react-router
  └── wavex-os API client (typed)
```

### 1.8 Feature parity matrix

| # | Feature | Wavex-os | Local | Notes |
|---|---|---|---|---|
| 1 | URL/repo enrichment with T2 (10 fields) | ✓ | ✗ (5 fields, no T2 router) | Major UX regression |
| 2 | Pillar1InferencePreview (confirm/correct) | ✓ | ✗ | UX gap |
| 3 | Per-companyId mutex on pillar writes | ✓ | ✓ | OK |
| 4 | Atomic write (tmp+rename) | ✓ | ✓ | OK |
| 5 | runPillarTransition (T0 inter-pillar hints) | ✓ | ✗ | UX gap |
| 6 | Pillar 2 Claude Code system probe | ✓ | partial | Probe simpler, no inference_budget_profile derivation |
| 7 | Phase 2 decision-matrix (16 connectors, 4 priorities) | ✓ | partial (5 connectors) | Backend gap |
| 8 | Phase 2 T2 refinement | ✓ | ✗ | Backend gap |
| 9 | Composio live connection folding | ✓ | ✗ | Backend gap |
| 10 | Composio bootstrap key flow | ✓ | ✗ | Backend gap |
| 11 | Phase 3 BASE_ROSTER (5 agents) | ✓ | ad-hoc | Backend gap |
| 12 | Phase 3 35+ activation predicates | ✓ | 7 predicates | Backend gap |
| 13 | Phase 3 credential-gated activation | ✓ | ✗ | Backend gap |
| 14 | Phase 3 T2 skill_overlay polishing | ✓ | ✗ | Backend gap |
| 15 | Phase 4 workflow templates (per agent×stage) | ✓ | minimal | Backend gap |
| 16 | Phase 4 bundle allocation calculator | ✓ | ✗ | Backend gap |
| 17 | Phase 4 budget enforcement vs claude_plan | ✓ | ✗ | Backend gap |
| 18 | Phase 4 T2 task mutation | ✓ | ✗ | Backend gap |
| 19 | Finalize Monte Carlo (30×30, deterministic) | ✓ | ✗ | Backend gap |
| 20 | Finalize imprint review T2 summary | ✓ | ✗ | Backend gap |
| 21 | Finalize manifest_hash + signatures | ✓ | sha256 only | Partial |
| 22 | Finalize YAML output | ✓ | JSON only | Partial |
| 23 | Credential vault (Drizzle + audit log) | ✓ | filesystem only | Functional but degraded multi-user |
| 24 | Credential concierge state machine | ✓ | ✗ | Major gap |
| 25 | Credential registry (per-key validators) | ✓ | ✗ | Major gap |
| 26 | Phase2ConnectorStep UI (full Composio flow) | ✓ | text rendering | Major UX gap |
| 27 | CredentialConciergeStep UI (paste/skip/validate) | ✓ | ✗ | Major UX gap |
| 28 | SwarmOrgChart visualization | ✓ | text table | Major UX gap |
| 29 | KPIVerification 3-tier disclosure | ✓ | ✗ | Major UX gap |
| 30 | Materialize agent count polling | ✓ | minimal | Partial UX |
| 31 | Halt screen with allow_override | ✓ | partial | Partial |
| 32 | Manifest cache (back-nav idempotency) | ✓ | ✗ | UX gap |
| 33 | Draft-inflight localStorage | ✓ | ✗ | UX gap |
| 34 | Better-Auth gates | ✓ | ✗ | Multi-user blocker |
| 35 | Tunable registry (50+ @tunable) | ✓ | ✗ | Maintainability gap |
| 36 | Differential equation suite | ✓ | ✗ | Test gap |
| 37 | Validation matrix runner | ✓ | ✗ | Test gap |
| 38 | Baseline capture (K1-K7) | ✓ | ✗ | Test gap |
| 39 | F1 enrichment fail-closed | ✓ | partial | F1 partially preserved |
| 40 | F2 concurrent write mutex | ✓ | ✓ | OK |
| 41 | F3 T2 output schema validation | ✓ | n/a (no T2) | Cannot regress |
| 42 | F4 agent status locked from T2 | ✓ | n/a (no T2) | Cannot regress |
| 43 | F5 credential gates for agents | ✓ | ✗ | Major gap |
| 44 | F6 workflow T2 cannot change structure | ✓ | n/a (no T2) | Cannot regress |
| 45 | F7 budget enforcement | ✓ | ✗ | Major gap |
| 46 | F8 MC deterministic | ✓ | ✗ | No MC |

**Parity score:** 6/46 features fully preserved, 8 partial, 32 absent or degraded. **The local branch is not a port; it is a structural reconstruction missing most production behavior.**

---

## PHASE 2 — Gap Analysis

### 2.1 Missing functionality (functional features absent)

**Server-side (4,591 LOC absent):**

| Component | Absent LOC | Impact |
|---|---|---|
| Phase 2 decision-matrix full registry | 442 - 87 = **355** | Connector recommendations missing 11 connectors; no bootstrap flow; no priority semantics |
| Phase 2 T2 generate + Composio fold | 262 - 0 = **262** | No live state, no rationale refinement |
| Phase 3 base-roster + activation rules | 400 - 91 = **309** | 5 agents → 8 with no role specialization; no credential gating; no unpark logic |
| Phase 3 generate (T2 + coerce + fallback) | 253 - 0 = **253** | No T2 polishing; no fallback logic |
| Phase 4 templates + bundle workflows | 312 - 66 = **246** | No archetype-specific workflows; no bundle allocation |
| Phase 4 generate + budget enforcement | 350 - 30 = **320** | No T2 task mutation; no budget halt |
| Finalize MC invocation | **116** | No strategy winner; no Sharpe ratio computation |
| Finalize imprint review | **129** | No T2 playbook summary |
| Finalize assemble + sign | 157 - 137 = **20** | Missing manifest_hash, dual signatures, YAML output, dry_run_state |
| Credential vault Drizzle + audit table | 353 - 149 = **204** | Filesystem only; no audit log table; no validation status tracking |
| Credential concierge state machine | **491** | Not exists |
| Credential registry validators | **382** | Not exists |
| Pillar transition T0 hints | **102** | Not exists |
| Tuning registry + print utilities | **612** | Not exists |
| Wavex-os plugin manifest + SDK | **84** | Plugin lifecycle absent |
| Pillar 1 deterministic-override + 10-field heuristics | 369 - 116 = **253** | Heuristics fall back to less data |
| Pillar 4 derive_gtm_profile + heuristics | 56 - 29 = **27** | Simplified |
| Pillar 5 board_endpoint_config full secrets handling | 31 - 49 = **-18** | Local has more (telegram only); wavex-os has registry-driven |
| Routes (24 endpoints in wavex-os) | 1188 - 369 = **819** | Local has 19 endpoints; missing concierge endpoints + KPI verify endpoint richness + materialize state endpoint + claude-code-check + loop-status |

**Total server-side absent: ~4,500 LOC of validated production behavior**

**UI-side (~3,500 LOC absent):**

| Component | Absent LOC | Impact |
|---|---|---|
| WavexOsOnboarding host (manifest cache, draft-inflight, dev escape, status auto-route nuance) | 655 - 159 = **496** | UX state machine simpler |
| Pillar1InferencePreview | **150** | No confirm/correct UX |
| phase1-host orchestration | **237** | No halt routing, no enrichment preview |
| Phase2ConnectorStep | 558 - 45 = **513** | No Composio flow, no per-card initiate |
| CredentialConciergeStep | **577** | No concierge UX |
| SwarmOrgChart | **509** | Just text table |
| KPIVerification 3-tier | **309** | No verify UX |
| materialize-phase | 308 - 66 = **242** | No agent count polling |
| Pillar 5 (Telegram + comm channel selectors) | 272 - 108 = **164** | Simpler form |
| Pillar 4 (lead sources, sales motion, close channel) | 143 - 75 = **68** | Simpler |
| Pillar 1 (URL/repo input) | 228 - 124 = **104** | Simpler |
| connector-view | 112 - 0 = **112** | Replaced by Phase2ConnectorStep |
| company-view | **94** | No final manifest summary |
| workflow-view + workflow-phase | 69 + 128 = **197** | No bundle allocation display |
| Helper libs (onboarding-draft, route, launch, goal, transition-hints, stage-baselines, ExpandedTextInput) | ~270 | All absent |

**Total UI-side absent: ~3,500 LOC**

**Test coverage absent:** ~7,000 LOC of differential-equation suite + harness + validation matrix + baseline capture. Local has 9 vitest + 5 e2e fixtures.

### 2.2 UI/UX differences

Critical UX regressions caused by simplification:

1. **No Pillar1InferencePreview** — operator cannot confirm/correct enriched signals (industry, product_state, has_product). Local just accepts whatever fields were filled.
2. **No CredentialConciergeStep** — operator cannot paste, skip, or validate credentials in a guided flow. Local pushes credential management to "later from Mission Control" without any infrastructure for that.
3. **No SwarmOrgChart** — operator sees a text table instead of an interactive org chart with status badges + skill overlay tooltips.
4. **No KPIVerification 3-tier** — operator cannot verify KPI snapshots with progressive disclosure (foundation → refinement → advanced). Local has no verify UI at all.
5. **No materialize-phase progress polling** — operator clicks materialize and either succeeds or fails; no "5/8 agents ready" progress.
6. **No halt screen routing in phase1-host** — operator hits a halt with no consistent recovery UX.
7. **No manifest cache** — operator clicking back regenerates expensive T2 outputs.
8. **No draft-inflight idempotency** — operator who refreshes mid-Pillar-1 may get a duplicate company.
9. **No Pillar 5 board_endpoint_config registry** — only Telegram is supported, with hardcoded vault keys; no Slack/SMS/email/Discord credential flows.
10. **No transition hints** — operator sees the same Pillar 4 options regardless of Pillar 3 stage; loses wavex-os's "if pre-product, sales_motion = none_yet first" specificity.

### 2.3 Missing backend behavior

1. **No T2 anywhere except Pillar 1 enrichment** — Phase 2/3/4 are deterministic-only; loses wavex-os's "T0 baseline + T2 refinement with measurable improvement" pattern (Suite 4 of differential-equation suite proves T2 adds value).
2. **No budget enforcement** — operator can configure a workflow that exceeds claude_plan budget without warning.
3. **No Monte Carlo** — no strategy_id winner, no Sharpe metric, no rationale.
4. **No imprint review** — no operator playbook summary.
5. **No concierge state machine** — credentials are write-only with no validation tracking.
6. **No credential registry** — no per-credential validators; pasting an invalid GitHub PAT writes it to vault unverified.
7. **No agent activation gates** — agents that depend on missing credentials are not parked; manifest doesn't reflect runtime reality.
8. **No materialize state** — `/wavex-os/onboarding/status` doesn't track materialize progress.
9. **No claude-code-check** — Pillar 2 simplified, no system probe.
10. **No multi-tier inference selection** — every T2 call goes to the same model; no fallback to cheaper tier when budget tight.

### 2.4 Missing validation/state persistence/business logic

1. **No Pillar 1 enrichment validation** — `isEnrichmentMeaningful()` exists but only the F1 length+keyword check; missing semantic validation of the 10 enriched fields.
2. **No schema versioning** — `COMPANY_MANIFEST_SCHEMA_VERSION = "1.0"` defined but no migration path for v2.
3. **No QA snapshot for KPI verification** — KPI verify endpoint stamps `ai_estimated: false` but doesn't preserve a separate verified-by-operator audit.
4. **No company rename detection** — wavex-os's Pillar 1 detects stub-name patterns and renames the DB row; local doesn't (no DB).
5. **No completed_at timestamp** — wavex-os writes `pillar_responses.completed_at = now` after finalize; local doesn't track.
6. **No materialize state** — agent creation is fire-and-forget; no expected/actual count.

### 2.5 Infrastructure incompatibilities

**Critical:** the runtime layer (`packages/observability/`) **requires Postgres**. The local branch has none. Effects:
- `getMissionControl()` cannot run; dashboard cannot show goal progress, bottlenecks, fleet stats
- `computeBottlenecks()` cannot run; no bottleneck digest
- `recordOutcomeAttribution()` cannot run; no forecast vs actual KPI tracking
- `getBudgetStatus()` cannot run; no token-budget enforcement (this is also a healing-layer requirement)
- launchd jobs that POST to `/api/maintenance/*` find no handlers (mock-core doesn't implement them)

The minimal flywheel was **designed against Postgres**. Substituting the filesystem for the database is what wavex-os's plugin does (the plugin is DB-free), but the SERVER LAYER above the plugin and the OBSERVABILITY LAYER alongside it both expect Postgres. The local branch breaks both.

**Other infrastructure gaps:**
- No Better-Auth → no multi-user; local is single-user only
- No Composio SDK → connector flow degraded
- No flywheel-kernel → no KPI snapshots, no MC, no bundle allocation
- No tier-router → no rate-limit budgeting, no multi-tier selection
- No `cost_events` table writes → token-budget cannot enforce
- No `kpi_snapshots` table → no KPI tracking over time
- No `heartbeat_runs` table → no spinner detection, no failure tracking
- No `task_outcome_attributions` table → no forecast accuracy

### 2.6 Technical debt risks

1. **Filesystem race conditions** — local `vault/store.ts` writes encrypted blobs to filesystem with no transaction; concurrent writes under per-companyId mutex are safe, but cross-company writes could theoretically conflict on shared keys (low risk).
2. **No audit log table** — credential reads are not logged; compliance/debugging blocker.
3. **JSON-only manifests** — humans cannot review wavex-os's signed manifests in YAML format (which is the canonical wavex-os format for diff review).
4. **No tunable registry** — when a constant needs tuning (e.g., `phase3.skill_overlay_slice = 400`), there's no central registry; must grep.
5. **No prompt version tracking** — when T2 prompts change, wavex-os tracks via tunable registry; local has no T2 prompts to track but will need this when wired.
6. **Type drift** — local schema files (`schema/manifests.ts`, etc.) duplicate wavex-os types but are not generated from wavex-os; they will drift unless explicitly synced.
7. **Test coverage gap** — local has 9 unit + 5 e2e tests; wavex-os has 17+ unit + differential-equation suite + validation matrix. Refactoring without these tests = blind regression.
8. **No baseline capture** — no measurable regression detection on K1-K7 metrics.
9. **No CI enforcement of frozen paths** — claim of frozen-path discipline relies on manual review.

---

## PHASE 3 — Migration Strategy

### 3.1 Strategy options

| Option | Description | Pros | Cons |
|---|---|---|---|
| **A. Wholesale port (vendored source)** | Copy wavex-os's `packages/plugins/onboarding/`, `server/src/{routes,services}/`, and `ui/src/components/wavex-os/onboarding/` files **byte-for-byte** into wavex-os. Provide adapter layer for what differs (DB connection, auth, plugin SDK). | Highest fidelity. Source code IS wavex-os's. Updates can be pulled by re-vendoring. Tests come along verbatim. | Carries wavex-os's full dependency surface; requires Postgres + Drizzle + Better-Auth + Composio SDK + tier-router + flywheel-kernel + plugin-sdk in wavex-os. |
| **B. Subtree merge** | Add wavex-os as a `git subtree` rooted at `vendor/wavex-os/`; reference its files directly from wavex-os build configs. | Cleanest history; updates via `git subtree pull`. | Same dependency surface as A. Subtree complicates contributor workflow. |
| **C. Incremental rewrite** | Continue from local branch state; add missing features one PR at a time. | Smaller PRs. | Drift risk; cannot validate against wavex-os until late. **Explicitly rejected by user directive.** |
| **D. Hybrid: vendored source + lazy-load shim** | Vendor wavex-os files; for wavex-os-specific deps (tier-router, flywheel-kernel), provide lazy-load shims that work in wavex but pass through to the vendored wavex-os plugin when available. | Source preservation + degradation path. | More moving parts. |

**Recommendation: Option A (Wholesale port).**

Rationale:
- User directive: "Do NOT replace systems unless absolutely necessary." Postgres is not "absolutely necessary" to replace — minimal flywheel already requires it.
- User directive: "Do NOT simplify the onboarding logic." Wholesale port is the only option that doesn't simplify.
- User directive: "preservation of functionality is the top priority." Wholesale source preservation is the strongest preservation.
- Vendoring wavex-os's tier-router and flywheel-kernel as code (they are TypeScript packages) means we don't lose T2 multi-tier inference or Monte Carlo.
- Better-Auth can be configured for single-user dev and full multi-user in production; not a blocker.
- Composio is genuinely optional (can be configured-but-disabled); wavex-os's UI handles this case.

### 3.2 Why wholesale port over incremental

Incremental rewrite (option C) was the previous strategy. It produced the local branch — a structural shadow. Each PR's "smaller scope" justified individual simplifications, and the cumulative effect is a system that does not match wavex-os behavior. The user has explicitly rejected this pattern.

Wholesale port carries wavex-os code intact. The risk profile is "infrastructure setup is hard once, then nothing drifts" rather than "every PR risks more drift."

### 3.3 Order of operations

```
STEP 0: Decision lock + rollback infrastructure
        - Tag current local branch as feat/wavex-os-onboarding-archive
        - Create new branch feat/wavex-os-fidelity from minimal-inception-self-healing
        - Ensure rollback path exists

STEP 1: Database infrastructure
        - Postgres setup script (docker-compose or local pg_ctl)
        - Drizzle migrations from wavex-os's @paperclipai/db schema
        - Required tables: companies, agents, credentials, credentialAuditLog,
          company_kpis, kpi_snapshots, cost_events, issues, heartbeat_runs,
          task_outcome_attributions, issue_comments

STEP 2: Plugin SDK shim
        - Vendor minimal subset of @paperclipai/plugin-sdk needed (manifest, health)
        - Or reimplement minimal interface (Plugin, PluginManifest, health() lifecycle)

STEP 3: Auth shim
        - Vendor or shim better-auth with single-user dev mode bypass
        - assertBoard() and assertCompanyAccess() return success in dev; gate properly in prod

STEP 4: T2 / inference infrastructure
        - Vendor @wavex-os/plugin-tier-router as code (TypeScript)
        - Wire to Anthropic API via existing wavex keychain wrapper
        - Provide rate-limit-budget integration (or stub with warning)

STEP 5: Flywheel kernel
        - Vendor @wavex-os/plugin-flywheel-kernel as code
        - KPI snapshot model + Monte Carlo engine + bundle allocation calculator
        - Ensure deterministic seed behavior

STEP 6: Composio integration
        - Add @composio/core to dependencies
        - Configure with CREDENTIAL_VAULT_MASTER_KEY-derived per-company keys (existing wavex-os crypto)
        - UI displays "Composio not configured" state gracefully

STEP 7: Vendor wavex-os plugin (packages/plugins/onboarding/)
        - Copy all 100+ files byte-for-byte to wavex-os/packages/wavex-os-plugin/
        - Adjust import paths only where the workspace name differs
        - Re-run vitest; all 17+ tests pass

STEP 8: Vendor wavex-os server routes + services
        - Copy server/src/routes/wavex-os-onboarding.ts (1,188 LOC) to packages/wavex-os-server/src/routes/
        - Copy services (credentialVault, credentialConcierge, credentialRegistry) to packages/wavex-os-server/src/services/
        - Wire routes onto Fastify (mock-core) instead of Express; or adopt Express

STEP 9: Vendor wavex-os UI
        - Copy ui/src/components/wavex-os/onboarding/ + ui/src/pages/WavexOsOnboarding.tsx to packages/onboarding-ui/src/wavex-os/
        - Copy ui/src/lib/{onboarding-draft, onboarding-route, onboarding-launch, onboarding-goal, wavexOsOnboarding}.ts
        - Adjust imports

STEP 10: Replace local wavex-os-onboarding package
        - Delete packages/wavex-os-onboarding/ (the simplified port)
        - All code now lives in packages/wavex-os-plugin/ + packages/wavex-os-server/

STEP 11: Replace local UI wavex-os/ subdirectory
        - Delete packages/onboarding-ui/src/wavex-os/ (the simplified port)
        - All code now from vendored wavex-os UI

STEP 12: Wire dashboard to wavex-os manifest output
        - MissionControl, KpiBoard, FleetGraph read wavex-os's company.manifest.{yaml,json}
        - Dashboard adapts to wavex-os shapes (camelCase for KPI registry, etc.)

STEP 13: Wire runtime layer
        - packages/observability/ now has DB; observability queries work
        - Healing layer's getBudgetStatus() works
        - launchd jobs POST to /api/maintenance/* and get real handlers

STEP 14: Differential equation suite + validation matrix
        - Vendor test suites verbatim
        - CI runs them on every commit

STEP 15: Tuning registry
        - Vendor src/tuning/* with print utilities
        - Document tunable values in docs/onboarding/tunables.md

STEP 16: End-to-end smoke
        - Reset Postgres + filesystem
        - Run 5 fixture companies through full pipeline (Pillars 1-5 + Phases 2-4 + Concierge + Finalize + Materialize)
        - Verify ALL files match wavex-os output (canonical hash check)
        - Verify dashboard hydrates with full KPI/agent/manifest data
        - Verify launchd jobs fire and runtime self-heals

STEP 17: Decommission previous branch
        - Tag final state
        - Update CLAUDE.md to reflect new architecture
```

### 3.4 Safe migration checkpoints

After each step:
- All 17+ wavex-os vitest tests pass (when applicable)
- `pnpm typecheck` clean
- `pnpm dev` boots without errors
- Manual smoke: navigate `/onboarding`, complete Pillars 1-5, confirm phases generate

After STEP 16:
- Differential-equation suite passes
- 5 fixture companies materialize without error
- Dashboard shows accurate goal/agents/KPIs
- Wrapper layer 1 self-heals on simulated 401
- Recovery protocol fires on simulated boot

### 3.5 Rollback strategy

- `feat/wavex-os-onboarding-archive` retained as last-known-good simplified state
- `feat/minimal-inception-self-healing` retained as integration target baseline
- Each STEP creates a commit that's reversible via `git revert`
- Postgres state is owned by this branch; can be reset via `dropdb wavex_dev && createdb wavex_dev && pnpm db:migrate`
- Filesystem state at `~/.wavex-os/instances/` can be `rm -rf` between runs

### 3.6 Testing methodology

**Per-step verification:**
1. **Vendoring steps (STEPS 7, 8, 9):** after copy, run `pnpm typecheck` then `pnpm test --filter=wavex-os-plugin`. Expected: all 17+ vitest tests green.
2. **Infrastructure steps (STEPS 1-6):** smoke against schema with `pnpm db:migrate && pnpm db:status` returning all tables present.
3. **Wiring steps (STEPS 10-15):** end-to-end manual walkthrough + Playwright e2e green.

**Continuous verification:**
- CI runs `pnpm typecheck`, vitest, Playwright e2e, and **wavex-os differential-equation suite** on every commit
- Baseline capture on every commit; deviation > threshold fails CI
- Manifest-shape validation against `examples/*.example.json` on every commit

**Manual verification (per fixture company):**
- Pillar 1: T2 enrichment fills 10 fields, Pillar1InferencePreview allows correction
- Pillar 2: claude-code-check probes binary, derives inference_budget_profile
- Pillar 3: product_state + stage drives KPI snapshot via flywheel-kernel
- Pillar 4: lead_sources + sales_motion + close_channel form gtm_profile_enum
- Pillar 5: comm_channel + Telegram credentials persist + test-send works
- Phase 2: 16 connectors with priorities, Composio fold-in, T2 refinement
- Phase 2B: Concierge state machine paste/skip/validate flows
- Phase 3: 5+ agents with credential gates, T2 skill_overlay polishing
- Phase 4: Bundle allocation + budget enforcement + T2 task mutation
- Pre-Finalize: KPI verification 3-tier disclosure
- Finalize: MC produces strategy winner, imprint review, signed manifest
- Materialize: agents created in DB, count polled, dashboard hydrates

### 3.7 State synchronization

Wavex-os writes pillar_responses.json, manifest YAML+JSON files, credential audit log. Wavex runtime reads these files. The wavex-projection layer (`src/projections/wavex-projection.ts`) is the only piece that **derives** wavex-shape files (agents.json, kpi-registry.json, wavex-os.config.json) FROM wavex-os's outputs.

In the wholesale port, this projection is no longer needed because **agents are written directly to the `agents` Drizzle table** during materialize, and `kpi-registry.json` becomes a runtime artifact derived from `company_kpis` table. The dashboard reads from DB directly via observability queries.

**Critical:** during migration, both paths must coexist briefly. Plan includes a dual-write phase where projections still write filesystem files while the runtime starts reading from DB. This allows incremental cutover without a "big bang."

### 3.8 Refactor requirements before migration

Before STEP 1:
- Audit `feat/minimal-inception-self-healing` to confirm Postgres URL config is wired (DATABASE_URL env var)
- Confirm `provision-chief-of-staff.sample.mjs` and `setup-hierarchy-and-kpis.sample.mjs` work against a fresh Postgres
- Confirm launchd job templates correctly substitute `${API_BASE}` to point at wavex-os server (not mock-core)

### 3.9 Components/services that should NOT be rewritten

**Vendor verbatim, do not modify:**
- `packages/plugins/onboarding/src/**` (12,100 LOC) — every line. No rewrites.
- `server/src/routes/wavex-os-onboarding.ts` (1,188 LOC) — every endpoint. Adapt only the framework binding (Express → Fastify if needed).
- `server/src/services/credentialVault.ts`, `credentialConcierge.ts`, `credentialRegistry.ts` (1,226 LOC) — verbatim.
- `ui/src/pages/WavexOsOnboarding.tsx` (655 LOC) — verbatim.
- `ui/src/components/wavex-os/onboarding/**` (4,687 LOC) — verbatim.
- `ui/src/lib/{wavexOsOnboarding, onboarding-*}.ts` (700 LOC) — verbatim.
- All test files (~7,000 LOC) — verbatim.

**Adapt at the boundary, do not modify internals:**
- Plugin SDK manifest format (just the entry point shape)
- Auth gates (just the assertBoard/assertCompanyAccess implementation)
- DB connection bootstrap (just the drizzle client initialization)
- Composio API key resolution (just the per-company key lookup)

---

## PHASE 4 — Implementation Plan

This phase requires execution decisions the user must make. Key decisions:

1. **Postgres deployment:** docker-compose vs local install vs cloud DB?
2. **wavex-os vendoring:** git subtree vs vendored copy vs npm publish?
3. **Better-Auth single-user dev mode:** stub or real config?
4. **Composio:** full integration or initial soft-disable?
5. **Branching:** keep `feat/wavex-os-onboarding-archive` and create `feat/wavex-os-fidelity` parallel?

Pending those decisions, the implementation skeleton:

### STEP 1 — Database infrastructure (1-2 days)

**Files added:**
- `infra/postgres/docker-compose.yml` — local Postgres for dev
- `packages/db/drizzle.config.ts` — schema location pointer
- `packages/db/src/schema/{companies,agents,credentials,kpi,cost,issues,heartbeat,attribution,comments}.ts` — port from wavex-os's @paperclipai/db
- `packages/db/migrations/0000_initial.sql` — Drizzle migration
- Root `package.json` scripts: `db:up`, `db:migrate`, `db:reset`

**Risk:** medium. Schema mismatches between wavex-os and minimal flywheel observability might require reconciliation.

**Verification:**
```bash
pnpm db:up
pnpm db:migrate
psql wavex_dev -c '\dt' # all tables present
```

### STEP 2 — Plugin SDK shim (1 day)

**Files added:**
- `packages/plugin-sdk-shim/src/index.ts` — Plugin interface, PluginManifest type, health() lifecycle hook
- Or alternatively: vendor `@paperclipai/plugin-sdk` from wavex-os tree

**Verification:** wavex-os's `manifest.ts` and `worker.ts` import the shim and typecheck.

### STEP 3 — Auth shim (1-2 days)

**Files added:**
- `packages/auth-shim/src/{index,assertBoard,assertCompanyAccess}.ts` — function interfaces matching better-auth's API
- Dev mode (env `WAVEX_AUTH_MODE=dev`): bypass; production wires real better-auth

**Verification:** smoke test `/wavex-os/onboarding/status` works in dev mode without auth header.

### STEP 4 — Tier router infrastructure (2-3 days)

**Files added:**
- `packages/tier-router/src/**` — vendored from `@wavex-os/plugin-tier-router`
- `packages/tier-router/src/route.ts` — `route(TierRoutingRequest): Promise<TierRoutingResponse>`
- Wire to existing `packages/wavex-os-onboarding/src/inference/claude-cli.ts` style spawn (replaces the simpler version)

**Risk:** high. Tier router has prompt-version registry, rate-limit integration, and budget-aware tier selection. Behavioral test required.

### STEP 5 — Flywheel kernel (2-3 days)

**Files added:**
- `packages/flywheel-kernel/src/**` — vendored from `@wavex-os/plugin-flywheel-kernel`
- KPI snapshot model + Monte Carlo simulator + bundle allocation calculator

**Verification:** `pnpm test --filter=flywheel-kernel` (port the relevant wavex-os tests).

### STEP 6 — Composio integration (1-2 days)

**Files added:**
- `packages/composio-shim/src/index.ts` — wrapper around `@composio/core` with per-company key lookup via vault
- Optional gate: `WAVEX_COMPOSIO_DISABLED=1` returns no-op stubs

### STEP 7 — Vendor wavex-os plugin (1 day vendoring + 1-2 days adjusting imports)

**Files added (verbatim from operator-omega):**
```
packages/wavex-os-plugin/
├── package.json (workspace deps: @wavex/plugin-sdk-shim, @wavex/tier-router, @wavex/flywheel-kernel)
├── tsconfig.json
├── vitest.config.ts
└── src/
    ├── index.ts
    ├── manifest.ts
    ├── worker.ts
    ├── errors.ts
    ├── claude-code-check.ts
    ├── schema/
    │   ├── pillar-responses.ts
    │   ├── connector-manifest.ts
    │   ├── swarm-manifest.ts
    │   ├── workflow-manifest.ts
    │   └── company-manifest.ts
    ├── phases/
    │   ├── phase-1-onboard/
    │   │   ├── pillar-{1..5}.ts
    │   │   └── *.test.ts
    │   ├── phase-2-connector/
    │   │   ├── decision-matrix.ts
    │   │   ├── prompt.ts
    │   │   ├── generate.ts
    │   │   └── *.test.ts
    │   ├── phase-3-swarm/
    │   │   ├── base-roster.ts
    │   │   ├── activation-rules.ts
    │   │   ├── decision-matrix.ts
    │   │   ├── prompt.ts
    │   │   ├── generate.ts
    │   │   └── *.test.ts
    │   ├── phase-4-workflow/
    │   │   ├── workflow-templates.ts
    │   │   ├── decision-matrix.ts
    │   │   ├── generate.ts
    │   │   ├── scheduled-routines.ts
    │   │   ├── bundle-workflows.ts
    │   │   ├── prompt.ts
    │   │   └── *.test.ts
    │   └── finalize/
    │       ├── mc-invocation.ts
    │       ├── imprint-review.ts
    │       ├── assemble.ts
    │       └── *.test.ts
    ├── state/
    │   ├── session.ts
    │   └── session.test.ts
    ├── inference/
    │   └── pillar-transition.ts
    ├── tuning/
    │   ├── registry.ts
    │   ├── print-map.ts
    │   └── print-chart.ts
    └── test/
        ├── differential-equation-suite/
        │   ├── suite-1-divergence.test.ts
        │   ├── suite-2-stability.test.ts
        │   ├── suite-3-surface-coverage.test.ts
        │   ├── suite-4-inference-value.test.ts
        │   ├── validation-matrix/
        │   │   ├── run-matrix.ts
        │   │   └── run-variants-detailed.ts
        │   ├── baseline/
        │   │   └── capture.ts
        │   └── harness/
        │       ├── run-onboarding-pipeline.ts
        │       ├── mock-inference-clients.ts
        │       ├── fixture-variant-generator.ts
        │       ├── compute-manifest-diff.ts
        │       └── compute-specificity-score.ts
        └── qa/
            ├── prompt-version-registry.ts
            ├── longitudinal-analyzer.ts
            └── generate-report.ts
```

**Verification:** `pnpm test --filter=wavex-os-plugin` runs all 17+ tests. All pass.

### STEP 8 — Vendor wavex-os server (1 day vendoring + 2-3 days framework adapt)

**Files added (verbatim):**
```
packages/wavex-os-server/
├── package.json (deps: drizzle-orm, fastify or express, @wavex/auth-shim, @wavex-os/plugin)
└── src/
    ├── routes/
    │   └── wavex-os-onboarding.ts (1,188 LOC, 24 endpoints)
    └── services/
        ├── credentialVault.ts (353 LOC)
        ├── credentialConcierge.ts (491 LOC)
        ├── credentialRegistry.ts (382 LOC)
        └── (any other /services that the routes import)
```

**Adapt:** if wavex-os uses Express and we need Fastify, add a thin Fastify-handler wrapper or convert routes (Fastify supports Express middleware via `@fastify/express`).

**Verification:** every endpoint returns expected shape against the differential-equation suite.

### STEP 9 — Vendor wavex-os UI (1-2 days)

**Files added (verbatim):**
```
packages/onboarding-ui/src/
├── pages/
│   └── WavexOsOnboarding.tsx (655 LOC)
├── components/
│   └── wavex-os/
│       └── onboarding/
│           ├── pillar-{1..5}.tsx
│           ├── Pillar1InferencePreview.tsx
│           ├── phase1-host.tsx
│           ├── connector-view.tsx
│           ├── Phase2ConnectorStep.tsx
│           ├── company-view.tsx
│           ├── workflow-view.tsx
│           ├── workflow-phase.tsx
│           ├── SwarmOrgChart.tsx
│           ├── CredentialConciergeStep.tsx
│           ├── generate-manifest-phase.tsx
│           ├── kpi-verify-phase.tsx
│           ├── KPIVerification.tsx
│           ├── materialize-phase.tsx
│           ├── halt-screen.tsx
│           ├── welcome-screen.tsx
│           ├── options.ts
│           ├── gtm-profile.ts
│           ├── progress-helpers.ts
│           ├── stage-baselines.ts
│           ├── transition-hints.ts
│           ├── primitives.tsx
│           └── ExpandedTextInput.tsx
└── lib/
    ├── wavexOsOnboarding.ts (428 LOC, API client)
    ├── onboarding-draft.ts
    ├── onboarding-route.ts
    ├── onboarding-launch.ts
    └── onboarding-goal.ts
```

**Adapt:** any Tailwind/CSS variable mismatches between wavex-os's ui/ and wavex's onboarding-ui/. CSS variables harmonized in a single pass.

### STEP 10-11 — Replace local wavex-os code (1 day)

```bash
# Delete local wavex-os code (the simplified port)
rm -rf packages/wavex-os-onboarding/
rm -rf packages/onboarding-ui/src/wavex-os/  # the local subdirectory
# (the vendored wavex-os code now occupies packages/wavex-os-{plugin,server}/ + packages/onboarding-ui/src/{pages,components/wavex-os,lib}/)

# Update mock-core to register vendored routes
sed -i '' 's|@wavex-os/onboarding|@wavex-os/server|g' packages/mock-core/src/server.ts

# Wire UI to use vendored WavexOsOnboarding
# packages/onboarding-ui/src/main.tsx already routes /onboarding → WavexOsOnboarding;
# import path adjustment only
```

**Verification:** typecheck + dev server boots.

### STEP 12 — Wire dashboard to wavex-os manifests (1-2 days)

**Files modified:**
- `packages/onboarding-ui/src/pages/MissionControl.tsx` — `useCompany()` reads URL param, queries `/api/instance/:companyId/manifest` returns wavex-os's company.manifest.json
- `packages/onboarding-ui/src/components/mission/KpiBoard.tsx` — reads from observability's `getMissionControl()` query (post-DB)
- `packages/onboarding-ui/src/components/mission/FleetGraph.tsx` — reads from observability's `defaultFleetStatsFn()` (post-DB)

**Note:** at this point, mock-core's `/api/instance/:companyId/*` endpoints either become Postgres-backed OR keep filesystem reads as a backup. Recommend: dual-write during transition, then deprecate filesystem reads.

### STEP 13 — Wire runtime layer (2-3 days)

**Files modified:**
- `packages/observability/` — already DB-backed; just needs DB connection wired (env DATABASE_URL)
- `packages/healing/` — wires to actual API endpoints (not mock-core stubs)
- `scripts/render-launchd-templates.mjs` — reads wavex-os.config.json that wavex-os's finalize wrote (or generates from DB)
- `scripts/provision-chief-of-staff.sample.mjs` — uses real DB connection

**Verification:**
- launchd `com.wavex-os.fleet-assessment` runs and POSTS to running orchestrator
- `getBudgetStatus(db, companyId)` returns real budget data
- `recordOutcomeAttribution()` writes to task_outcome_attributions table

### STEP 14 — Differential equation suite + validation matrix (1 day)

Already vendored in STEP 7. Just wire CI:
- `package.json` test script: `pnpm test --filter=wavex-os-plugin --reporter=verbose`
- CI workflow: run on every commit; fail on regression in K1-K7 baseline metrics

### STEP 15 — Tuning registry (½ day)

Already vendored in STEP 7. Document tunables:
- `docs/onboarding/tunables.md` — generated from `print-map.ts` output
- Show 50+ tunables with their axes, ranges, coupling, risks

### STEP 16 — End-to-end smoke (1-2 days)

**Test plan:**
1. Reset Postgres + filesystem
2. Manually walk acme-saas fixture through full pipeline
3. Verify pillar_responses.json, all 4 manifests, signed company.manifest.{yaml,json}, agents in DB
4. Verify dashboard hydrates with goal/agents/KPIs
5. Verify launchd jobs fire (or simulate triggers via curl)
6. Verify wrapper layer 1 self-heals on simulated 401 (force expired token)
7. Run differential-equation suite × 4
8. Run validation matrix runner against 5 fixtures

### STEP 17 — Decommission previous branch (½ day)

- Tag current state: `git tag wavex-os-fidelity-v1`
- Update `CLAUDE.md` with new repo map
- Archive `feat/wavex-os-onboarding` branch metadata
- Set `feat/wavex-os-fidelity` as main integration branch

**Total estimated effort:** 25–35 working days = **5–7 weeks** for one focused engineer.

---

## PHASE 5 — Quality Assurance

### 5.1 Validation framework

**Behavioral parity:**
- Per-fixture (5 companies): run pipeline in wavex-os original → save artifacts to `tests/baseline/<fixture>/`
- Run same pipeline in wavex-os fidelity branch → save artifacts to `tests/actual/<fixture>/`
- Diff with `compute-manifest-diff.ts`: every artifact must match (modulo timestamps + UUIDs)
- ANY structural drift = test failure

**Edge case coverage (from wavex-os tests):**
- Pillar 1 with no manual_context AND no T2 result (forced fallback)
- Pillar 1 with stub-name pattern triggering company rename
- Pillar 2 with each claude_plan value
- Pillar 3 with each product_state × stage combination
- Pillar 4 with each gtm_profile_enum derivable + edge case (custom)
- Pillar 5 with each comm_channel + Telegram/Slack credentials
- Phase 2 with Composio configured + with Composio disabled + with auth_config_not_found error
- Phase 3 with credential vault state {valid, skipped, invalid, unvalidated}
- Phase 4 with budget over/under cap; bypassBudgetCheck flag
- Finalize with skipInference flag; with deterministic seed; with imprint failure → template fallback
- Concierge: paste, skip, validate (success), validate (invalid), revoke, finalize
- Materialize: idempotent (re-run is no-op)

**Infrastructure compatibility:**
- Postgres reachability check on boot
- Drizzle migrations green
- launchd plist render correctness
- Wrapper layer 1 self-heal on simulated 401
- OAuth refresh under contention (5 concurrent /oauth/refresh calls → all coalesce to one in-flight)

**Performance:**
- Onboarding wall-time: target ≤90s for full pipeline (Pillars 1-5 + Phases 2-4 + Finalize) without T2 calls
- With T2 calls: ≤180s (timer-based hard cap; halts if over)
- Phase 2 connector generation < 5s
- Materialize agent creation < 10s for 8 agents

**No silent failures:**
- Every catch block must log to structured logger (not just console)
- Every halt must surface in UI; never swallow
- Every T2 timeout (30s) must produce a fallback path
- Every DB write must be transactional with rollback on partial failure

### 5.2 Regression prevention

**Pre-commit hooks:**
- `pnpm typecheck` on staged files
- `pnpm lint` (when added)
- `pnpm test --filter=wavex-os-plugin --no-coverage` for changed-file impact tests

**CI gates:**
- All vitest tests pass
- All Playwright e2e tests pass
- Differential-equation suite passes (Suite 1-4)
- Validation matrix passes for 10+ canonical fixtures
- Baseline capture: K1-K7 metrics within ±5% of recorded baseline
- Frozen-path enforcement: `git diff --name-only origin/feat/minimal-inception-self-healing... -- <frozen paths>` returns empty
- Manifest-shape validation: every `examples/*.example.json` parses cleanly into the appropriate type

**Monitoring (production):**
- Per-onboarding wall-time histogram
- T2 call success/failure rate
- Composio API success/failure rate
- Credential vault read/write rate (per company)
- Materialize success rate (per fixture)

### 5.3 Edge cases that must remain functional

| Edge case | Test |
|---|---|
| Operator refreshes mid-Pillar-1 | draft-inflight prevents duplicate company creation |
| T2 enrichment returns < 40 chars | F1 fallback to manual_context branch |
| Two browser tabs submit same Pillar 1 | per-companyId mutex prevents clobbering |
| Concurrent /oauth/refresh calls | coalesce to single in-flight Promise |
| Composio API key invalid | Phase 2 surfaces `composio.invalid_api_key` recovery banner |
| Credential vault Master Key missing | crypto module logs warning + uses temp key (in-memory) for the session |
| MC simulator with seed 42 | deterministic; same input = same output |
| Pillar 4 with all "custom" inputs | gtm_profile_enum = "custom"; downstream phases handle without crashing |
| Materialize re-run | idempotent; agents not duplicated |
| Phase 4 budget over plan | halt with operator override flag |

### 5.4 Acceptance criteria

The migration is complete when:

1. **All 17+ wavex-os vitest tests green** in wavex-os repo
2. **Differential-equation suite passes** in CI
3. **Validation matrix runner produces matching reports** to wavex-os original (within tolerance)
4. **Baseline capture K1-K7** within recorded baseline ±5%
5. **All 5 fixture companies materialize successfully** end-to-end
6. **Dashboard hydrates correctly** for each fixture
7. **launchd jobs fire and self-heal** under simulated failure
8. **`grep -r "wavex-os onboarding"` finds zero results** in source files
9. **Behavioral parity** with wavex-os original confirmed for every test fixture
10. **No degraded UX** — every step from wavex-os exists in wavex-os fidelity branch

---

## Committed decisions (2026-05-07)

The seven open questions are resolved as follows. Each pick maximizes wavex-os
fidelity AND keeps local development friction-free using the operator's Claude
Max OAuth keychain as the inference source.

### 1. Database — PGlite for dev, Postgres for prod

**Choice:** Embedded PGlite (Node-native) for `pnpm dev`; real Postgres
(RDS / Neon / Supabase / self-hosted) for production.

**Why:** PGlite runs in-process — no Docker daemon, no install. The inception
branch's `.env.example` already documents PGlite as a fallback. Same Drizzle
schema and same migrations target both. Operator gets a one-command boot;
production still gets a real Postgres.

**Implementation:** `packages/db/` exposes `getDb()` that returns a Drizzle
instance backed by PGlite when `WAVEX_DB_DRIVER=pglite` (default in dev) or
node-postgres when `WAVEX_DB_DRIVER=pg` (default in prod). Migrations apply
identically against both.

### 2. Vendoring — git subtree from operator-omega

**Choice:** `git subtree add --prefix=vendor/wavex-os/ ../operator-omega main --squash`.

**Why:** Subtree puts wavex-os's plugin + server + UI bytes into wavex-os's
own git history. No submodule setup for downstream consumers; no npm publish
contract to maintain. Future wavex-os upstream improvements pull cleanly via
`git subtree pull --prefix=vendor/wavex-os/ ../operator-omega main --squash`.
Both repos already exist locally.

**Implementation:** All adapter code lives in `packages/wavex-os-plugin/`,
`packages/wavex-os-server/`, and `packages/onboarding-ui/src/wavex-os/`,
which import from `vendor/wavex-os/` rather than the npm registry.

### 3. Auth — `WAVEX_AUTH_MODE` env flag

**Choice:** Dual mode with environment switch. `WAVEX_AUTH_MODE=dev` (default
when `NODE_ENV=development`) returns a synthetic single-user board context
from `assertBoard()` and `assertCompanyAccess()`. `WAVEX_AUTH_MODE=production`
requires real Better-Auth setup with OAuth provider config.

**Why:** Wavex-os already uses this idiom (`?dev=1` escape hatches in
`WavexOsOnboarding.tsx`). Localhost has zero auth friction; prod gets full
multi-user gating with no code-path divergence — only the gate function
differs.

**Implementation:** `packages/auth-shim/src/index.ts` exports `assertBoard`
and `assertCompanyAccess` that branch on `WAVEX_AUTH_MODE`. Vendored
wavex-os code imports from this shim, not from `better-auth` directly.

### 4. Composio — optional via `WAVEX_COMPOSIO_DISABLED`

**Choice:** Soft-disable in dev. Default `WAVEX_COMPOSIO_DISABLED=1` for
`pnpm dev`. When disabled, Phase 2's connector decision-matrix runs in full
but Composio fold-in returns `[]` and the UI surfaces "configure later from
Mission Control" for Composio-managed connectors. Direct-key connectors
(GitHub PAT, Supabase, Mixpanel) work without Composio via the credential
vault.

**Why:** Composio adds genuine value (OAuth orchestration for ~70 services)
but requires a Composio account + API key. Forcing operators through that
sign-up just to test the wizard is wrong. Production sets `COMPOSIO_API_KEY`
and the UI surfaces full OAuth flows.

**Implementation:** `packages/composio-shim/src/index.ts` exports the
`@composio/core` surface wavex-os imports. When disabled, all methods return
empty results and emit a `composio.disabled` event. When enabled, calls pass
through to `@composio/core`.

### 5. Branching — archive + fresh branch (✓ executed STEP 0)

**Choice:** Tag `wavex-os-onboarding-archive` preserves the simplified-port
work. New `feat/wavex-os-fidelity` forks from
`feat/minimal-inception-self-healing` (the inception branch with healing +
observability + launchd templates already in place).

**Why:** Clean diff against the integration target. Archive is recoverable
as a tag if any subset of the simplified work proves useful (e.g. the
projection layer's KPI-registry mapping). New branch has no inherited
simplifications.

**Status:** ✅ Done at STEP 0 (this commit).

### 6. Inference — `WAVEX_INFERENCE_MODE` flag in tier-router shim

**Choice:** Vendor `@wavex-os/plugin-tier-router` source. Adapt only the
boundary inference call inside `packages/wavex-os-plugin/src/inference/`.

- **Dev (`WAVEX_INFERENCE_MODE=oauth`, default for `pnpm dev`):** spawn
  `claude -p <prompt> --model <model>` with `ANTHROPIC_API_KEY` cleared, so
  the claude CLI uses the operator's OAuth keychain. This matches the
  pattern that already works in PR 11 of the archived branch (the
  `claude-anthropic-direct.sh` wrapper).
- **Production (`WAVEX_INFERENCE_MODE=apikey`):** uses `ANTHROPIC_API_KEY`
  env var directly via the official Anthropic SDK.

**Why:** Operator explicitly required "continued development using my
inference." This routes every T2 call (Pillar 1 enrichment, Phase 2/3/4
refinement, Imprint Review) against the local Claude Max subscription
during dev. The `route()` signature stays identical — vendored wavex-os
code doesn't change; only the boundary inference call swaps.

**Implementation:** `packages/wavex-os-plugin/src/inference/router.ts`
exports `callTier()` matching wavex-os's signature. Internally branches on
`WAVEX_INFERENCE_MODE`. Wraps `scripts/wrappers/claude-anthropic-direct.sh`
in dev mode (already exists, frozen).

### 7. Schedule + resourcing — 7 weeks, four shippable milestones

**Choice:** Phased delivery with reviewable + halt-able state at each gate.

| Milestone | Weeks | Outcome |
|---|---|---|
| **M1: Infrastructure** | 1-2 | PGlite + Drizzle migrations + plugin SDK shim + auth shim + tier-router vendored + flywheel-kernel vendored + Composio shim. System boots, no onboarding yet. Dev workflow validated. |
| **M2: Vendor + wire** | 3-4 | Wavex-os plugin + server + UI vendored verbatim. All 17+ vitest tests green. End-to-end pipeline runs for 1 fixture company. Dashboard hydrates from Postgres. |
| **M3: Runtime + observability** | 5-6 | Healing layer self-heals against real DB. Observability queries return real KPI/cost/heartbeat data. launchd jobs fire and post to live endpoints. 5 fixture companies materialize cleanly. |
| **M4: Test framework + decommission** | 7 | Differential-equation suite passes in CI. Tuning registry documented. Baseline capture green. Old branch decommissioned. Production-ready. |

**Resourcing:** single engineer (the operator), with the operator's Claude
session as the inference engine for both onboarding pipeline T2 calls and
development assistance.

---

With these seven decisions committed, STEPS 1-17 are unblocked. STEP 0 has
been executed (tagged + branched). STEP 1 (PGlite + Drizzle scaffolding) is
the next reviewable commit.
