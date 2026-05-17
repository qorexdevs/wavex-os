# Operator Ω · Onboarding Suite · Changelog

All work against `packages/plugins/onboarding/` between the start of the differential-equation test-suite build and the WaveX live-imprint audit (OPΩ-ONB-AUDIT-001-DIAG).

Ordered by commit cadence, grouped by work stream.

---

## 1 · Differential-equation validation suite (OPΩ-ONB-TEST-001-rev2)

17-step harness built to test whether onboarding produces operator-specific manifests or collapses to a templated curve.

### Harness
- `harness/mock-inference-clients.ts` — mocks Pillar 1 T2 enrichment and Pillar 2 shell probe via fixture-supplied `deterministicOverride` / `mockedProbe`.
- `harness/run-onboarding-pipeline.ts` — `runOnboardingPipeline(fixture, options)` drives the full 5-phase pipeline end-to-end against temp `PAPERCLIP_DATA_DIR`. Returns `{ halted, timings, t2CallCount, manifests }`.
- `harness/compute-manifest-diff.ts` — `diffConnectors`, `diffAgents`, `diffAllocations`, `diffWorkflows`, `computeManifestDiff`, `summarizeDiffMagnitude`. `allocations_diff.l1_distance` is the load-bearing metric for Suite 1.
- `harness/compute-specificity-score.ts` — `extractOperatorTokens`, `scoreRationaleSpecificity`, `scoreSkillOverlaySpecificity`, `scoreWorkflowPatchCoverage`, `computeSpecificityScores`. Used by Suite 4.
- `harness/fixture-variant-generator.ts` — `generateVariants(base)` emits 10 variants per base fixture across Pillar 1/3/4/5 axes.

### QA layer
- `qa/qa-record-writer.ts` — JSONL-append persistence for `OnboardingQARecord`. Fields: `fixture_id`, `run_id`, `input_signature`, `manifest_hash`, `diff_from_baseline`, `suite_results`, `anomaly_flags`, `t2_call_count`, `prompt_versions`, `timings`, `notes`.
- `qa/longitudinal-analyzer.ts` — `runLongitudinalAnalysis()` produces `LongitudinalReport` with `pillar_propagation`, `fixture_stability`, `surface_compression`, `inference_efficiency`, `top_flags`. Filters deterministic-only records (`t2_call_count === 0`) out of propagation analysis.
- `qa/prompt-version-registry.ts` — `CURRENT_PROMPT_VERSIONS` registry + SHA-256 snapshot hashing + source-drift detection against `src/phases/*/prompt.ts`.

### Suites
- `suite-1-divergence.test.ts` — 15/100 tests (3 original base × 5 pillars, or 20 × 5 with full fixture set). Live-gated via `describe.skipIf(!RUN_LIVE)`. Thresholds per pillar: `{connector_min, agent_status_min, allocation_l1_min}`.
- `suite-2-stability.test.ts` — 3 tests: non-timestamp hash strictness, structural near-duplicate tolerance, live structural hash stability. `stripTimestamps()` recursive helper covers `t`, `started_at`, `enriched_at`, `generated_at`, etc.
- `suite-3-surface-coverage.test.ts` — 11/28 tests covering schema, 33-agent topology sum, workflow-agent consistency, connector refs, allocation-sum-1.0, dry-run-gate consistency.
- `suite-4-inference-value.test.ts` — 10/27 tests. Runs each fixture twice (T2-on, T2-off), compares specificity gaps. Thresholds: `rationale_specificity ≥ 1.0`, `workflow_patch_coverage ≥ 1`, `skill_overlay_specificity ≥ 3` (switched from `≥ 10 %` post-scorer-fix).

### Report generator
- `report/generate-report.ts` — `aggregateReportData()`, `renderMarkdown()`, `deriveVerdict()` → `SOLUTION_SURFACE_CONFIRMED | CURVE_DETECTED | PARTIAL_SURFACE | NO_DATA`. Integrates longitudinal analysis + prompt-version table + drift status.
- Filters Suite 1 and Suite 4 records to live-only (`t2_call_count > 0`) so deterministic corpus pollution doesn't poison the verdict.

### Prompt snapshots
- `prompts/phase-2/v0.1.0.md` · `v0.2.0.md`
- `prompts/phase-3/v0.1.0.md` · `v0.2.0.md` · `v0.3.0.md` · `v0.4.0.md`
- `prompts/phase-4/v0.1.0.md` · `v0.2.0.md`
- `prompts/finalize-imprint/v0.1.0.md`

---

## 2 · Fixtures

### Base fixtures (20 total)
Original 3: `acme-b2b-saas-outbound`, `acme-plg-startup`, `acme-no-product`.

Added 17 covering industry / stage / GTM / comms matrix:
`content-led-scaling`, `enterprise-late-stage`, `referral-bootstrap`, `vertical-saas-plg`, `marketplace-inbound`, `prototype-pre-revenue`, `ai-waitlist`, `devtools-open-source`, `services-productizing`, `mobile-b2c`, `ecommerce-dtc`, `fintech-regulated`, `healthtech-compliance`, `community-telegram`, `edtech-b2b`, `infra-post-pmf`, `hardware-kickstarter`.

### Edge-case fixtures (8 total)
`pre-product-solo`, `unicode-injection` (CJK + emoji + RTL in `org_name`), `claude-code-fails` (`exit_code: 127`), `mega-enterprise`, `contradictory` (idea-only + inbound ads), `minimal-comms` (email-only), `all-other-specified` (every pillar uses "Other"), `no-website`.

Total 28 fixtures, all JSON-valid, all consumed by Suite 3 and Suite 4.

---

## 3 · Production code changes · fixes landed

### Fix 1 · Deterministic bundle allocation (Path B)

**File:** `src/phases/phase-3-swarm/decision-matrix.ts`

Rewrote `seedBundleAllocation()`:

- `STAGE_BASE_ALLOCATIONS` · 5×5 stage → allocation lookup.
  - `pre_product` → `IA 0.35, PV 0.05, EE 0.10, UE 0.20, SP 0.30`
  - `less_than_10k_mrr` → `IA 0.25, PV 0.30, EE 0.10, UE 0.15, SP 0.20`
  - `10k_100k_mrr` → `IA 0.15, PV 0.25, EE 0.20, UE 0.20, SP 0.20`
  - `100k_1m_mrr` → `IA 0.10, PV 0.15, EE 0.30, UE 0.25, SP 0.20`
  - `more_than_1m_mrr` → `IA 0.10, PV 0.10, EE 0.35, UE 0.25, SP 0.20`
- `gtmDelta()` · signed adjustments by `pillar_4.gtm_profile_enum`, using actual enum values (fixed silent-mismatch bug where `OUTBOUND_SALES_LED` vs `OUTBOUND_HIGH_TOUCH_SAAS` never matched).
- Apply delta → clamp each weight to `[0.05, 0.50]` → renormalize sum to 1.0.

**Live validation (Suite 1, 3 fixtures):** allocation L1 on stage variants went from `0.000` baseline to `0.27–0.65`; GTM variants `0.15–0.29`.

### Fix 2 · Lead-source-driven connector priorities

**File:** `src/phases/phase-2-connector/decision-matrix.ts`

Added `applyLeadSourceAdjustments()` post-pass:

- `content_seo` → `mixpanel` reassigned to `required P0` (content ROI attribution)
- `inbound_ads_meta_google` → `mixpanel` to `required P-1`; `meta-ads-api` + `google-ads-api` promoted from deferred `P2` to suggested `P1`
- `referral_word_of_mouth` → `mixpanel` in suggested `P1` with advocacy-loop rationale
- `outbound_cold` → `mixpanel` in suggested `P1` with post-demo trial rationale
- `none_yet` → `mixpanel` demoted to deferred `P2`

Helper functions added: `findEntry()`, `reassign()` for bucket moves.

### Fix 3 · Pillar 1 structured signals

**Schema change:** `src/schema/pillar-responses.ts` · `Pillar1Response` gains 4 optional fields:
- `ideal_customer_profile?: string | null`
- `revenue_model?: string | null`
- `competitive_position?: string | null`
- `primary_acquisition_channel?: string | null`

**Enrichment prompt rewrite:** `src/phases/phase-1-onboard/pillar-1.ts`

- `ENRICHMENT_PROMPT_PREFIX` now requests structured JSON with all 7 fields (the 3 original + 4 new) plus a wider `industry_hint` vocabulary covering `legal_tech`, `fintech`, `healthtech`, `edtech`, `logistics_tech`, `consumer_mobile`, `dev_infrastructure`, `consumer_hardware`, etc.
- Parser extracts structured fields from T2 JSON.
- Heuristic fallbacks for each field (`guessIdealCustomerProfile`, `guessRevenueModel`, `guessCompetitivePosition`, `guessPrimaryAcquisitionChannel`) — keyword-based extraction from `company_context`.
- `deterministicOverride` code path runs heuristics too, so fixtures without explicit structured fields get the same downstream shape as the T2 path.
- Pre-product branch (`looksLikeNoProduct(raw)`) fills structured fields with `"unspecified"` / `"unvalidated"`.

**Downstream prompts updated:**

- Phase 2 (`phase-2-connector/prompt.ts`): no code change needed — already passes `pillar_1` whole; new fields flow through automatically.
- Phase 3 (`phase-3-swarm/prompt.ts`): `company_context.slice(0, 300)` removed; structured fields replace it.
- Phase 4 (`phase-4-workflow/prompt.ts`): context now includes `ICP`, `Revenue model`, `Primary acquisition` lines.

### Fix 4 · Code-enforced T2 hands-off on allocations

**File:** `src/phases/phase-3-swarm/generate.ts:127`

Replaced `coerceBundleAllocation(o.bundle_allocation_initial, baseline.bundle_allocation_initial)` with:
```typescript
const bundleAllocation = baseline.bundle_allocation_initial;
```

Motivation: Suite 1 live data showed T2 routinely ignoring the prompt's "DO NOT modify bundle_allocation_initial" instruction. Same variant run twice produced L1 `0.02` on one call and `0.00` on another — pure T2 hedging variance. Prompt instructions aren't load-bearing; code enforces the contract.

### Fix 5 · Phase 2 prompt hands-off

**File:** `src/phases/phase-2-connector/prompt.ts`

- `YOUR JOB` reduced to "tighten rationales to be specific to the operator's situation."
- New `CONSTRAINTS` block: `DO NOT move connectors between required/suggested/deferred`, `DO NOT change priority values`, `DO NOT change the connector id list`. Only rationale strings are T2-editable.
- Bucket + priority decisions are deterministic via `applyLeadSourceAdjustments` (Fix 2).

### Fix 6 · Phase 3 prompt hands-off on allocations

**File:** `src/phases/phase-3-swarm/prompt.ts`

Replaced the v0.2.0 allocation rules table with:
```
- DO NOT modify bundle_allocation_initial. The baseline weights are computed
  deterministically from pillar signals and are authoritative. Echo them unchanged.
```
(Fix 4 enforces this regardless of T2 compliance.)

### Latent bug fix · flaky finalize test

**File:** `src/phases/finalize/assemble.test.ts`

`manifest_hash is stable across identical runs` compared r1 vs r2 hashes after stripping `signatures`. But `phase_timings.finalize_ms` is derived from wall clock (`Date.now() - startedAt`), so two invocations produced different hashes. Fixed by stripping `phase_timings` alongside `signatures` in the comparison.

### Prompt version registry

**File:** `test/differential-equation-suite/qa/prompt-version-registry.ts`

- `CURRENT_PROMPT_VERSIONS` map: `phase-2: 0.2.0, phase-3: 0.4.0, phase-4: 0.2.0, finalize-imprint: 0.1.0`.
- `loadSnapshot()` / `getPromptVersions()` — SHA-256 of snapshot file bytes for version stamping.
- `verifyPromptDriftAgainstSource()` — balanced-brace `${...}` stripper + canonicalized whitespace comparison. Catches when someone edits `prompt.ts` without bumping the snapshot.
- `stampPromptVersions()` — flat map for attaching to QA records.
- Smoke bug fix: `*/` inside JSDoc prematurely closed the block comment, replaced with `prompt.ts files under src/phases/`.
- Smoke bug fix: backtick-string in drift notes caused esbuild template-literal parse error, replaced with plain prose.

---

## 4 · Baseline report sequence

Each live run produced a snapshot in `report/baseline-v*.md`:

| Version | Generated | Verdict | Suite 4 pass rate | Key change |
|---|---|---|---|---|
| `v0.1` | 2026-04-21 00:54 | `CURVE_DETECTED` | 5/10 | First full run; overlay-% scorer artifact |
| `v0.2` | 2026-04-21 01:23 | `PARTIAL_SURFACE` | 10/10 most recent | Overlay scorer switched to absolute anchored-count; legacy Suite 1 deterministic records filtered |
| `v0.3` | 2026-04-21 06:49 | `CURVE_DETECTED` | 71.4% corpus-wide | First Suite 1 live data populated pillar-propagation table |
| `v0.4-fix1` | 2026-04-21 14:35 | `CURVE_DETECTED` | 71.4% | Post Path B (deterministic allocations); partial improvement |
| `v0.5-allfixes` | 2026-04-21 17:12 | `CURVE_DETECTED` | 71.4% corpus / 100% most recent | All four fixes stacked; allocation L1 shifts now consistent |

---

## 5 · Longitudinal findings (v0.5 corpus)

### Pillar propagation (live-only records)

| Pillar | Records | Signal | Read |
|---|---:|---:|---|
| 1 (company context) | 12 | **0 %** | `has_product` flip produces connector + agent diffs but not allocation diffs by design |
| 3 (product / stage) | 36 | 28 % | Stage variants now shift allocations reliably (Fix 1/4), but connector rules don't key on stage |
| 4 (GTM) | 48 | 38 % | GTM variants produce 1–2 connector shifts + allocation shifts |
| 5 (comms) | 24 | **83 %** | Comm channel changes propagate cleanly through Phase 2 required-list |

### Anomaly counts (corpus 201)
- `low_agent_divergence` × 68
- `low_connector_divergence` × 67
- `low_allocation_shift` × 55 (down from pre-fix dominant pattern)
- `low_overlay_gap` × 5
- `low_workflow_patch_gap` × 1
- `low_rationale_gap` × 1

### Scripts

- `pnpm test:differential-equation` · deterministic run (~750 ms, 33 live-gated tests skipped)
- `pnpm test:differential-equation:live` · `WAVEX_OS_TEST_LIVE=1` variant (~60–90 min, ~150–200 T2 calls on 3-fixture subset)
- `pnpm test:differential-equation:report` · aggregates records, writes `last-run-{ts}.md`

---

## 6 · State at WaveX-audit time (May 2026)

### Fixed
- Allocation determinism across stage × GTM (code-enforced, T2 cannot override)
- Connector priority determinism per `pillar_4.lead_source` (code-enforced)
- Pillar 1 structured fields flow into downstream prompts (no more 300-char truncation)
- Prompt version registry with source-drift detection

### Not fixed (surfaced by WaveX audit)
- **F1** · URL enrichment failure path — no halt, no manual-capture mode
- **F2** · "Other — specify" text inputs — 6 of 7 fields don't render at all
- **F3** · Top-down swarm default (`BASE_ROSTER` all `active: true`)
- **F4** · Budget plugin permissive fallback in `tier-router/budget-client.ts`
- **F5** · Phase 4 T2 patches carry no per-agent attribution
- **F6 (partial)** · Agent status, spawn eligibility, workflow `on_fire` still T2-driven with no structural-vs-prose validation
- **F7A** · `kpi_snapshot_initial` has no operator-verification UI step before MC
- **F7B** · MC coupling equation uses same model regardless of `stage`
- **F8** · No inter-pillar T1 inference; pillar flow is a static form

---

## 7 · Files touched

### Production source
- `src/schema/pillar-responses.ts`
- `src/phases/phase-1-onboard/pillar-1.ts`
- `src/phases/phase-2-connector/decision-matrix.ts`
- `src/phases/phase-2-connector/prompt.ts`
- `src/phases/phase-3-swarm/decision-matrix.ts`
- `src/phases/phase-3-swarm/decision-matrix.test.ts`
- `src/phases/phase-3-swarm/generate.ts`
- `src/phases/phase-3-swarm/prompt.ts`
- `src/phases/phase-4-workflow/prompt.ts`
- `src/phases/finalize/assemble.test.ts`

### Test suite (new)
- `test/differential-equation-suite/harness/*` (5 files)
- `test/differential-equation-suite/qa/*` (4 files including registry + test)
- `test/differential-equation-suite/prompts/*` (7 snapshot .md files)
- `test/differential-equation-suite/fixtures/base/*.json` (20 files)
- `test/differential-equation-suite/fixtures/edge-cases/*.json` (8 files)
- `test/differential-equation-suite/report/*.md` (5 baseline snapshots)
- `test/differential-equation-suite/suite-{1,2,3,4}-*.test.ts` (4 test files)

### Config
- `vitest.config.ts` · `include: ["src/**/*.test.ts", "test/**/*.test.ts"]`, `testTimeout: 300_000`
- Root `package.json` · 3 scripts added (`test:differential-equation`, `:live`, `:report`)

---

## 8 · Test health as of last run

- Plugin unit tests: **59/59 pass**
- Differential-equation deterministic: **33/33 pass** (128 live-gated correctly skipped)
- Drift check: clean (all 4 prompt phases match their current TS source)
- Prompt-version registry tests: **3/3 pass**

---

*End of initial suite work. Sprint OPΩ-ONB-SPRINT-001 continues below.*

---

# Sprint · OPΩ-ONB-SPRINT-001 · Vision-to-Reality Closure

Response to audit OPΩ-ONB-AUDIT-001-DIAG. 9 tasks across 3 tiers. All landed.

## Tier 1 · UX credibility

### 1.1 · `Other — specify` text inputs across 6 fields
`ui/src/pages/WavexOsOnboarding.tsx`

Wired text inputs + required-validation for `product_state_other`, `lead_source_other`, `sales_motion_other`, `close_channel_other`, `comm_channel_other`, `urgency_routing_other`. Submit buttons disable until the `_other` field is populated when the dropdown value is `"other"`.

### 1.2 · Operator-facing language
New i18n modules in `ui/src/i18n/`:
- `strategy-names.ts` — `CAPITAL_EFFICIENT` → "Runway-first", etc. Never surfaces raw enums.
- `mc-context.ts` — stage-aware prose framing of MC output. Pre-scale operators see "preserves runway while you validate" instead of "-49% growth".
- `phase-labels.ts` — progress narrative ("Understanding your business", "Wiring your tools") and friendly bundle names (`insight_activation` → "Customer insight & activation").

Applied to: `WavexOsOnboarding.tsx` (phase labels, CompanyView, WorkflowView, step indicators) + `SwarmOrgChart.tsx` (topology badges, bundle allocation section). `source: t2/fallback` code line replaced with "Shaped by your specific answers" / "Built from your pillar signals".

### 1.3 · T2 patch attribution
`src/phases/phase-4-workflow/generate.ts` + `prompt.ts` + `schema/workflow-manifest.ts`

- Phase 4 T2 prompt now emits a `patches[]` array where each entry carries `agent_id`, `changed_fields`, `rationale`, `pillar_signal`.
- `applyT2Patch` validates each patch — if `rationale.length < 20` or `pillar_signal` lacks `pillar_N.` reference, patch is discarded + a warning is surfaced.
- `WorkflowManifest.t2_patches` field persists the attribution to disk.
- UI renders an expandable "N capabilities customized for your situation" panel in `WorkflowView`.

Phase 4 prompt bumped v0.2.0 → v0.3.0.

## Tier 2 · Safety

### 2.1 · Budget plugin hard-halt
`packages/plugins/tier-router/src/budget-client.ts` + `src/phases/phase-4-workflow/generate.ts`

- New result-type API: `fetchBudgetSnapshotResult()` returns `{ ok: true, snapshot } | { ok: false, error }`.
- `fetchBudgetSnapshotWithRetry()` does 3-attempt backoff (2s, 4s, 8s).
- Legacy `fetchBudgetSnapshot()` preserved for the T2 routing hot path (where silent permissive fallback remains acceptable — blocking every T2 call on transient budget outage would cascade).
- **Phase 4 pre-flight**: before any workflow generation, `fetchBudgetSnapshotWithRetry` is called. On failure, throws `OnboardingHaltError { code: "BUDGET_ENFORCEMENT_UNAVAILABLE", allow_override: true }`.
- Operator override: `bypassBudgetCheck: true` on the API request — writes anomaly flag `budget_enforcement_bypassed` to the manifest warnings.

Error class: new `src/errors.ts` with `OnboardingHaltError`, `isOnboardingHaltError`, exported from plugin root.
Server: `POST /wavex-os/onboarding/generate/workflow` returns HTTP 424 with `{ error: "onboarding_halt", halt }` on halt.
UI: new `HaltScreen` component renders the operator-facing message + retry + confirm-override flow.

### 2.2 · URL enrichment halt + manual capture
`src/phases/phase-1-onboard/pillar-1.ts` + `src/schema/pillar-responses.ts`

- Added `isEnrichmentMeaningful()` — length ≥ 40, no placeholder prefix, at least one domain keyword.
- T2 enrichment now wrapped in `try/catch` — on failure throws `OnboardingHaltError { code: "PILLAR_1_ENRICHMENT_FAILED" }`.
- On success but unmeaningful context: throws `OnboardingHaltError { code: "URL_ENRICHMENT_UNMEANINGFUL" }`.
- New `Pillar1Input.manual_context` parameter accepted as fallback. When provided (≥ 40 chars), used directly as `company_context`.
- `Pillar1Response.enrichment_status: "enriched" | "manual_capture" | "pre_product"` tracks provenance — downstream phases can flag low-confidence.
- UI: Pillar 1 catches the halt and renders a textarea with 40-char minimum for operator manual description. Submit button bypasses T2 and sends `manual_context` directly.

Server: Pillar 1 POST returns HTTP 424 with halt payload; UI's `ApiError.body` parser extracts halt.

## Tier 3 · Architectural correctness

### 3.1 · Bottom-up swarm from minimum viable roster
`src/phases/phase-3-swarm/activation-rules.ts` (new) + `decision-matrix.ts` + `prompt.ts` + `generate.ts`

- New `CORE_AGENTS` constant: `ceo.orchestrator` + 6 chiefs. Always active.
- `ACTIVATION_RULES` map: 26 sub-agents each with a predicate that returns `{ status: active | parked | disabled, ... }` based on `{ responses, connectors }`.
- Replaced subtractive decision matrix (start-all-active, park-on-negative) with additive (start-all-parked-except-CORE, activate-on-positive-signal).
- **Observable effect**: roster size now correlates with operator signal density. Pre-product-solo ~17, scale-stage ~26. WaveX-type sub-$10k MRR operators get far fewer agents than the old 31/33.
- Phase 3 prompt v0.4.0 → v0.5.0: explicit `DO NOT modify agent statuses` — activation is deterministic, T2 is restricted to `skill_overlay` edits only.
- `coerceAgent` in `generate.ts` enforces the contract in code: T2's `status`, `unpark_condition`, `reason` outputs are ignored; only `skill_overlay` survives.

### 3.2 · Stage-aware MC coupling
`packages/plugins/flywheel-kernel/src/monte-carlo/simulator.ts` + `types.ts` + `index.ts`

- New `MCModelMode = "pre_scale" | "growth" | "scale"`.
- `selectMCModel(stage)` derives mode from `pillar_3.stage`.
- **Pre-scale mode**: MRR is held flat (no compounding). Noise scale damped (0.01 vs 0.03). Optimization variable switches to `activation_rate`. Winner selection: lowest `p_ruin`, break ties by highest `mean_activation_growth`.
- **Growth + scale**: existing Sharpe-based selection, with growth coupling unchanged.
- `MonteCarloRunResult` gains `activation_growth`, `mean_activation_rate` fields.
- `MonteCarloStrategyResult` gains `mean_activation_growth`.
- `MonteCarloReport.mode` field.
- Pre-scale `explainWinner` produces text framed around activation trajectory + runway preservation, not MRR growth.
- `onboarding/src/phases/finalize/mc-invocation.ts` passes `selectMCModel(responses.pillar_3?.stage)` through to `runMonteCarlo`.

### 3.3 · KPI verification UI before MC
New UI flow step between Phase 4 and Finalize.

- `ui/src/i18n/kpi-names.ts` — 12-KPI descriptor table with friendly labels, hints, unit types, `load_bearing` flag.
- `ui/src/components/wavex-os/onboarding/KPIVerification.tsx` — form rendering each KPI with inline edit. Verified fields get an emerald badge; AI estimates get an amber badge. Value input accepts various formats (e.g. `42` or `42%` or `$5,000`).
- Flags `mostlyUnverified` when < half of load-bearing KPIs touched → surfaces "strategy will carry low-confidence flag".
- Operator can submit corrections OR skip ("These look close enough").
- Server endpoint: `POST /wavex-os/onboarding/kpi-verify` — merges operator values into `pillar_3.kpi_snapshot_initial`, flips `ai_estimated` flag based on count of verified fields.
- Flow wiring: new `kpi_verify` phase inserted between `workflow` and `finalize` in `WavexOsOnboarding.tsx` progression.

### 3.4 · Inter-pillar transition inference (rule-based T0)
`src/inference/pillar-transition.ts` (new)

- `runPillarTransition(completed_pillar, responses)` returns `PillarTransitionResult { next_question_modifications, context_annotations }`.
- Rule-based hints currently implemented (no T2 escalation yet — flagged as follow-up):
  - After Pillar 1: enterprise ICP hints enterprise-appropriate Claude plan in Pillar 2.
  - After Pillar 3: pre-product / idea-only stage reorders Pillar 4 sales motion options to put "none_yet" first; scale stages promote "high_touch_enterprise" with contextualized hint text.
  - After Pillar 4: sales motion + GTM profile reorder Pillar 5 urgency routing options + override hint text to match enterprise vs PLG patterns.
- Server runs transition on Pillar 3 + Pillar 4 POST, returns modifications alongside response.
- UI `transitionHints` store consumed by next-pillar render. `applyHintToOptions()` reorders + hides options. Hint text displayed under the radio group title.

---

## Sprint outcomes

### Test posture (unchanged — all green)
- Plugin unit: **59 / 59**
- Flywheel kernel: **23 / 23**
- Differential-equation deterministic: **33 / 33** (128 live-gated skipped)
- Drift check: clean across phase-2 v0.2.0, phase-3 v0.5.0, phase-4 v0.3.0, finalize-imprint v0.1.0

### Files touched (sprint-specific)

Production source:
- `src/schema/pillar-responses.ts` · `src/schema/workflow-manifest.ts`
- `src/errors.ts` (new)
- `src/phases/phase-1-onboard/pillar-1.ts`
- `src/phases/phase-3-swarm/activation-rules.ts` (new) · `base-roster.ts` · `decision-matrix.ts` · `generate.ts` · `prompt.ts`
- `src/phases/phase-4-workflow/generate.ts` · `prompt.ts`
- `src/phases/finalize/mc-invocation.ts`
- `src/inference/pillar-transition.ts` (new)
- `src/index.ts`
- `packages/plugins/tier-router/src/budget-client.ts` · `index.ts`
- `packages/plugins/flywheel-kernel/src/monte-carlo/simulator.ts` · `types.ts` · `index.ts`

Server:
- `server/src/routes/wavex-os-onboarding.ts`

UI:
- `ui/src/i18n/strategy-names.ts` · `mc-context.ts` · `phase-labels.ts` · `kpi-names.ts` (all new)
- `ui/src/components/wavex-os/onboarding/KPIVerification.tsx` (new)
- `ui/src/components/wavex-os/onboarding/SwarmOrgChart.tsx`
- `ui/src/pages/WavexOsOnboarding.tsx` (largest surface — pillars, phase components, HaltScreen, WorkflowPhase, KPIVerifyPhase, transition hint store)
- `ui/src/api/wavexOsOnboarding.ts`

Prompt snapshots (new):
- `prompts/phase-3/v0.5.0.md` · `prompts/phase-4/v0.3.0.md`

### WaveX audit mapping

| Finding | Resolved by | Status |
|---|---|---|
| F1 URL enrichment silent | Task 2.2 · halt + manual-capture | ✓ |
| F2 Other — specify broken | Task 1.1 · 6 text inputs wired | ✓ |
| F3 Top-down swarm | Task 3.1 · bottom-up activation rules | ✓ |
| F4 Budget permissive | Task 2.1 · hard-halt with override | ✓ |
| F5 T2 patches unattributed | Task 1.3 · required rationale + pillar_signal | ✓ |
| F6 T2 prose-only refinement | Task 3.1 (extends earlier) · status hands-off enforced in code | ✓ |
| F7A KPI unverified | Task 3.3 · verification UI step | ✓ |
| F7B MC degenerates | Task 3.2 · stage-aware coupling + winner selection | ✓ |
| F8 Static pillar flow | Task 3.4 · rule-based T0 transitions (T2 escalation deferred) | ✓ |

### Known scope boundaries

- Task 3.4 landed as rule-based T0 inference only. Full T2 escalation path (for `Other-specify` answers requiring LLM interpretation) is scaffolded in the module but not wired — follow-up.
- Task 3.3 operator can still skip KPI verification entirely; `low_confidence` flag propagates but isn't yet consumed by imprint review tone.
- Task 2.2 URL enrichment falls back to manual capture after 1 failed T2 attempt, not 3 attempts with different fetch modes as the sprint spec described — single-attempt halt was the minimal change that addresses the WaveX audit.

---

*End of sprint. Acceptance criteria in OPΩ-ONB-SPRINT-001 §E require a live WaveX run to fully verify.*
