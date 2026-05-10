# Operator Ω · Surface Tuning Map

> Auto-generated from `packages/plugins/onboarding/src/tuning/registry.ts`.
> Regenerate with `pnpm omega:tune:map`. Do not edit by hand.

## 2D framing

- **Diversity pull** — how much raising this value widens per-operator variation (surface spread).
- **Accuracy pull** — how much raising this value improves faithfulness to operator inputs.

Both range `-2..+2`. A tunable with high diversity and low accuracy is a diversity dial; one with high accuracy and low diversity is a quality dial; one high in both is a rare free lunch; one low in both is dead weight.

## Coupling

- **runtime** — edit the constant, redeploy. No prompt or snapshot changes.
- **prompt** — value is mirrored in a T2 prompt body. Bump the version in `CURRENT_PROMPT_VERSIONS` and refresh the snapshot under `test/differential-equation-suite/prompts/<phase>/v<ver>.md`, then run the drift detector.
- **structural** — adding/removing an enum, strategy, or agent. Requires code + prompt + tests together.

Total tunables: **40**.

## 1 · Active agent set

### phase-3

| id | coupling | div | acc | current | description | safe range | risk | location |
|---|---|---|---|---|---|---|---|---|
| `phase3.core_agents` | structural | -1 | +1 | 7 ids (ceo.orchestrator, cpo, cmo, cro, cfo, cdo, coo) | Always-active base roster before industry/stage gating. | — | Removing a C-suite breaks reports_to graph + downstream bundle allocation. | `packages/plugins/onboarding/src/phases/phase-3-swarm/activation-rules.ts:32` |
| `phase3.stage_order` | structural | 0 | +2 | pre_product=0..more_than_1m_mrr=4 | Ordinal ranks for revenue stages (drives activation thresholds). | — | Reordering mis-activates sub-agents at the wrong revenue threshold. | `packages/plugins/onboarding/src/phases/phase-3-swarm/activation-rules.ts:58` |
| `phase3.base_roster` | structural | 0 | +1 | 33 agents (CEO 15m/$300, chiefs 1h/$120, L·IV 2h-6h/$60-80) | 33-agent base roster with heartbeats + default budgets. | — | Roster size mismatch with prompt → T2 emits unknown ids, silently dropped. | `packages/plugins/onboarding/src/phases/phase-3-swarm/base-roster.ts:43` |
| `phase3.base_roster_size` | structural | 0 | +1 | 33 | Canonical count of base roster members. | — | Must match base_roster entries exactly or tests fail. | `packages/plugins/onboarding/src/phases/phase-3-swarm/base-roster.ts:94` |
| `phase3.valid_statuses` | structural | +1 | +1 | active, parked, disabled (standby in flight) | Allowed agent status values. | — | Adding status requires UI rendering + downstream materialize rules. | `packages/plugins/onboarding/src/phases/phase-3-swarm/generate.ts:27` |
| `phase3.spawn_rationale_slice` | runtime | +1 | 0 | 300 | Max chars for spawn-eligibility rationale strings. | 200..400 | — | `packages/plugins/onboarding/src/phases/phase-3-swarm/generate.ts:104` |
| `phase3.t2_timeout_ms` | runtime | 0 | 0 | 120000 | T2 inference timeout for swarm generation. | 90000..240000 | — | `packages/plugins/onboarding/src/phases/phase-3-swarm/generate.ts:180` |

## 2 · Overlay tokens

### phase-3

| id | coupling | div | acc | current | description | safe range | risk | location |
|---|---|---|---|---|---|---|---|---|
| `phase3.skill_overlay_slice` | runtime | +2 | 0 | 400 | Max chars for per-agent skill_overlay text. | 240..600 | Too short → overlays lose specificity; too long → sidebar card overflow. | `packages/plugins/onboarding/src/phases/phase-3-swarm/generate.ts:64` |

## 3 · Workflow tasks

### phase-4

| id | coupling | div | acc | current | description | safe range | risk | location |
|---|---|---|---|---|---|---|---|---|
| `phase4.valid_tiers` | structural | +1 | +2 | T0, T1, T2 | Allowed task inference tiers (T0 deterministic, T1 Ollama, T2 Claude). | — | Adding a tier requires routing + cost accounting changes. | `packages/plugins/onboarding/src/phases/phase-4-workflow/generate.ts:32` |
| `phase4.valid_flows` | structural | +1 | +1 | ASN, TLM, CON, VAL | Allowed workflow flow types (ASN/TLM/CON/VAL). | — | — | `packages/plugins/onboarding/src/phases/phase-4-workflow/generate.ts:33` |
| `phase4.slice_caps` | runtime | +1 | -1 | task=120, connector=60, input/output=120, target=60, on=200, to=60 | Char caps on task/connector/input/output/target/escalation text. | task 80..200, target 40..100 | — | `packages/plugins/onboarding/src/phases/phase-4-workflow/generate.ts:83` |
| `phase4.attribution_slices` | runtime | +1 | 0 | rationale=240, pillar_signal=120 | Char caps on T2-patch attribution (rationale, pillar_signal). | — | — | `packages/plugins/onboarding/src/phases/phase-4-workflow/generate.ts:135` |
| `phase4.task_cap` | prompt | +2 | -1 | 6 | Max on_fire tasks emitted per agent. | 4..8 | Higher cap → diluted per-task quality; prompt mentions the number. | `packages/plugins/onboarding/src/phases/phase-4-workflow/generate.ts:146` |
| `phase4.specificity_gate` | prompt | -1 | +2 | ≥5 distinct OR ≥2 diff, noDuplicates | Acceptance gate on T2 patch: ≥N distinct pillar signals OR ≥M differentiation signals. | distinct 3..6, diff 2..3 | Too strict → fallback to deterministic template for most operators. | `packages/plugins/onboarding/src/phases/phase-4-workflow/generate.ts:245` |
| `phase4.reprompt_cap` | runtime | +1 | +1 | 2 | Max re-prompts allowed after a specificity-gate failure. | 1..4 | Higher cap → operator wait grows linearly with token cost. | `packages/plugins/onboarding/src/phases/phase-4-workflow/generate.ts:273` |
| `phase4.baseline_workflow_for` | structural | -1 | +1 | static templates keyed by agent archetype | Per-archetype default task templates used when T2 patch is rejected or skipped. | — | — | `packages/plugins/onboarding/src/phases/phase-4-workflow/workflow-templates.ts:192` |
| `phase4.scheduled_routines` | runtime | 0 | 0 | 5 cron routines | Flywheel cron specs (couple/criticality hourly, bifurcate 4h, reallocate Mon 00:00, monte-carlo daily 03:00). | — | Tight intervals blow up cost; loose intervals stale MC priors. | `packages/plugins/onboarding/src/phases/phase-4-workflow/scheduled-routines.ts:9` |
| `phase4.t2_timeout_ms` | runtime | 0 | 0 | 180000 | T2 inference timeout for workflow generation. | 120000..300000 | — | `packages/plugins/onboarding/src/phases/phase-4-workflow/generate.ts:232` |

## 4 · Bundle allocation (L1)

### phase-3

| id | coupling | div | acc | current | description | safe range | risk | location |
|---|---|---|---|---|---|---|---|---|
| `phase3.stage_base_allocations` | runtime | +2 | +2 | 5 stage vectors (each sums to 1.0 across IA/PV/EE/UE/SP) | Per-stage base allocation vectors across 5 bundles. | Each weight 0.05..0.50, row sum == 1.0 | Non-normalized rows skew downstream MC priors. | `packages/plugins/onboarding/src/phases/phase-3-swarm/decision-matrix.ts:51` |
| `phase3.balanced_default` | runtime | -2 | 0 | [0.20, 0.20, 0.20, 0.20, 0.20] | Fallback vector when stage is unknown/other. | — | — | `packages/plugins/onboarding/src/phases/phase-3-swarm/decision-matrix.ts:59` |
| `phase3.gtm_delta` | runtime | +2 | +2 | 8 gtm profiles × up to 5 deltas each (±0.05..±0.10) | Signed allocation adjustments per GTM profile (outbound/inbound/plg/etc). | ±0.02..±0.15 per delta | Large deltas push clamps; mis-signed deltas invert GTM intent. | `packages/plugins/onboarding/src/phases/phase-3-swarm/decision-matrix.ts:71` |
| `phase3.industry_delta` | runtime | +2 | +1 | ~8 industries × 1..3 deltas each (±0.05) | Signed allocation adjustments per industry (fintech/consumer/etc). | ±0.02..±0.10 per delta | Overlap with gtm_delta can double-tilt and collide with clamp bounds. | `packages/plugins/onboarding/src/phases/phase-3-swarm/decision-matrix.ts:99` |
| `phase3.clamp_bounds` | runtime | +2 | -1 | [0.05, 0.50] | Min/max per-bundle weight after layering gtm + industry deltas. | min 0.02..0.10, max 0.40..0.70 | Loose clamps let one bundle dominate; tight clamps collapse toward balanced. | `packages/plugins/onboarding/src/phases/phase-3-swarm/decision-matrix.ts:138` |

### phase-4

| id | coupling | div | acc | current | description | safe range | risk | location |
|---|---|---|---|---|---|---|---|---|
| `phase4.canonical_bundle_workflows` | structural | 0 | +1 | IA=24h, PV=1w, EE=per-account, UE=1d, SP=1mo | 5 bundles × cycle length + canonical routine templates. | — | Cycle length changes cascade into scheduled-routines cron specs. | `packages/plugins/onboarding/src/phases/phase-4-workflow/bundle-workflows.ts:12` |

## 5 · Connector set

### phase-2

| id | coupling | div | acc | current | description | safe range | risk | location |
|---|---|---|---|---|---|---|---|---|
| `phase2.registry_ids` | prompt | +2 | +1 | 16 ids (claude-code, mixpanel, slack, supabase, github, telegram, whatsapp, shopify, segment, hubspot, plaid, posthog, meta-ads-api, google-ads-api, linkedin-sales-nav, twilio-sms) | Whitelist of connector IDs T2 may emit. Drops any out-of-set entries silently. | Mirror the set in the phase-2 prompt body; drop in pairs (code+prompt). | Adding an id not known to the connector registry service → downstream credential flow 404s. | `packages/plugins/onboarding/src/phases/phase-2-connector/generate.ts:36` |
| `phase2.valid_priorities` | prompt | 0 | +1 | P-1, P0, P1, P2 | Allowed priority tiers for connector entries. | — | Adding a tier without prompt + validator update causes silent drops. | `packages/plugins/onboarding/src/phases/phase-2-connector/generate.ts:31` |
| `phase2.valid_statuses` | structural | 0 | +1 | configured, pending_credential, pending_decision | Allowed status values for connector entries. | — | New statuses need UI render support + authz implications. | `packages/plugins/onboarding/src/phases/phase-2-connector/generate.ts:32` |
| `phase2.rationale_slice` | runtime | +1 | -1 | 240 | Max chars for per-connector rationale text. | 160..400 | Too short → rationales lose specificity; too long → token cost + skimming fatigue. | `packages/plugins/onboarding/src/phases/phase-2-connector/generate.ts:82` |
| `phase2.blocked_reason_slice` | runtime | +1 | -1 | 300 | Max chars for blocked-connector reason text. | 200..450 | — | `packages/plugins/onboarding/src/phases/phase-2-connector/generate.ts:96` |
| `phase2.t2_timeout_ms` | runtime | 0 | 0 | 90000 | T2 inference call timeout for phase-2 connector generation. | 60000..180000 | Too short → fallback to deterministic scaffold; too long → operator waits. | `packages/plugins/onboarding/src/phases/phase-2-connector/generate.ts:156` |

## 6 · Dry-run gates

### phase-2

| id | coupling | div | acc | current | description | safe range | risk | location |
|---|---|---|---|---|---|---|---|---|
| `phase2.dry_run_window_days` | runtime | 0 | 0 | 14 | Days before external writes auto-require board approval. | 7..30 | <7 gives operators no time to catch drift; >30 normalizes unsupervised writes. | `packages/plugins/onboarding/src/phases/phase-2-connector/decision-matrix.ts:19` |

## 7 · MC winner

### finalize

| id | coupling | div | acc | current | description | safe range | risk | location |
|---|---|---|---|---|---|---|---|---|
| `finalize.friction_keywords` | runtime | +2 | +2 | activation, onboarding, procurement, enterprise, long sales cycle, pricing, paywall, conversion, integration, setup, runway | Keyword list driving Lever-E friction-biased winner re-selection. | 8..18 keywords | Over-broad matches trigger re-selection on non-friction hypotheses. | `packages/plugins/onboarding/src/phases/finalize/mc-invocation.ts:56` |
| `finalize.p_ruin_activation_threshold` | runtime | +1 | +2 | 0.25 | Max p_ruin allowed when friction=activation rewrites winner to RETENTION_FIRST. | 0.15..0.35 | — | `packages/plugins/onboarding/src/phases/finalize/mc-invocation.ts:66` |
| `finalize.p_ruin_safety_cap` | runtime | +1 | +1 | 0.4 | Max p_ruin allowed for any friction-biased strategy override. | 0.25..0.5 | Loose cap → friction override selects risky strategies. | `packages/plugins/onboarding/src/phases/finalize/mc-invocation.ts:85` |
| `finalize.mc_strategy_ids` | structural | +2 | +1 | 5 strategies | Named strategies MC considers (RETENTION_FIRST, BALANCED, ACQUISITION_HEAVY, NARRATIVE_LED, CAPITAL_EFFICIENT). | — | Adding a strategy requires kernel-side equations + prompt registry entry. | `packages/plugins/onboarding/src/phases/finalize/mc-invocation.ts:72` |
| `finalize.imprint_context_slices` | runtime | +1 | -1 | 400, 180 | Char caps for imprint summary context (primary=400, secondary=180). | primary 300..600, secondary 120..240 | — | `packages/plugins/onboarding/src/phases/finalize/imprint-review.ts:28` |

## 8 · MC projection (L2)

### finalize

| id | coupling | div | acc | current | description | safe range | risk | location |
|---|---|---|---|---|---|---|---|---|
| `finalize.mc_horizon_cycles` | runtime | +1 | 0 | 30 | Monte Carlo projection horizon in flywheel cycles. | 12..60 | Short horizon hides long-tail ruin; long horizon inflates variance. | `packages/plugins/onboarding/src/phases/finalize/assemble.ts:65` |
| `finalize.mc_n_runs` | runtime | +1 | +2 | 30 | Monte Carlo sample size per strategy. | 20..100 | <20 → noisy winner selection; >100 → latency. | `packages/plugins/onboarding/src/phases/finalize/assemble.ts:66` |
| `finalize.mc_seed` | runtime | 0 | 0 | 42 | RNG seed for MC reproducibility. | — | Fixed seed guarantees reproducibility but masks sensitivity across variants. | `packages/plugins/onboarding/src/phases/finalize/assemble.ts:67` |
| `finalize.mc_model_mode_map` | structural | +1 | +2 | stage-indexed lookup | Stage → MC coupling mode (pre_scale / growth / scale). | — | Wrong mapping → MC coupling equation uses the wrong stage prior. | `packages/plugins/onboarding/src/phases/finalize/mc-invocation.ts:48` |

