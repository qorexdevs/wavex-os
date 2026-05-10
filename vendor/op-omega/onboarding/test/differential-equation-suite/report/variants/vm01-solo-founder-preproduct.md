# Variant report · vm01-solo-founder-preproduct

*Pipeline mode:* **LIVE T2**
*Fixture description:* Validation matrix F1 · Solo founder pre-product, B2B dev tool idea. Expected: small swarm (9-12), minimal connectors, MC pre_scale.

## Operator inputs (Pillars 1–5)

- **Company:** Logcolor · `no product yet`
- **Claude plan:** max_20x
- **Stage:** idea_only · Pre-product
- **Lead sources:** none_yet
- **Sales motion:** none_yet
- **Board comms:** telegram · all_to_one_channel

## Phase 1 · Pillar 1 enrichment

- **Enrichment status:** `enriched`
- **Industry hint:** dev_tools
- **Business model:** subscription
- **Has product:** no
- **Ideal customer profile:** early-stage founders
- **Revenue model:** subscription
- **Competitive position:** emerging
- **Primary acquisition channel:** unspecified
- **Product maturity signal:** ga
- **Tone signal:** technical
- **Primary friction hypothesis:** friction point not clearly specified — infer from GTM stage
- **Differentiator hypothesis:** Solo founder building a developer observability tool that reduces log noise for backend engineers

**Company context:**
> Solo founder building a developer observability tool that reduces log noise for backend engineers. Target customer: engineering managers at 50-500 person companies. Nothing built yet.

## Phase 2 · Connector manifest

*Source: T2 · onboarding/phase-2*

| Bucket | Count | Connectors |
|---|---:|---|
| Required | 2 | `claude-code`, `telegram` |
| Suggested | 1 | `github` |
| Deferred | 2 | `mixpanel`, `posthog` |
| Blocked on approval | 0 | — |

### Required — details

| ID | Priority | Status | Dry-run | Rationale |
|---|---|---|---|---|
| Claude Code (inference) | P-1 | configured | — | Inference bootstrap for Logcolor — verified on max_20x plan in Pillar 2. |
| Telegram (Board notifications) | P0 | pending_credential | no | Solo founder routing all Board alerts to one Telegram channel per Pillar 5. |

### Suggested — details

| ID | Priority | Status | Rationale |
|---|---|---|---|
| GitHub (code + ship events) | P1 | pending_decision | Pre-product dev tool — wire GitHub now so first ship events for Logcolor are tracked from day one. |

## Phase 3 · Swarm manifest

*Source: T2 · onboarding/phase-3*

### Topology
- Total base roster: **33**
- Active: **16**
- Standby: 0
- Parked: 13
- Disabled: 2

### Bundle allocation

| Bundle | Weight |
|---|---:|
| Customer insight & activation | 33% |
| Pipeline & conversion | 4% |
| Retention & expansion | 9% |
| Efficiency & runway | 26% |
| Positioning & narrative | 28% |

### Active agents (16)

| Agent | Department | Level | S+ | Skill overlay |
|---|---|---|:-:|---|
| `ceo.orchestrator` | ceo | L·II |  | solo_founder_mode: Logcolor has one operator — sequence work, protect focus, and defer anything not tied to shipping a v0 backend-log-noise tool |
| `cdo` | data | L·III |  | hypothesis_over_metrics: pre-product, so Logcolor has no telemetry — treat founder interviews and GitHub signal as the primary dataset |
| `cdo.infer` | data | L·IV | ✓ | inference_from_interviews: Logcolor has no product telemetry — synthesize signal from founder interviews, Telegram chatter, and GitHub activity into testable hypotheses |
| `cfo` | finance | L·III |  | bootstrap_runway: Logcolor is self-funded and pre-revenue — focus on runway discipline and keeping burn near zero until a paid signal lands |
| `cfo.capital` | finance | L·IV |  | bootstrap_mode: Logcolor is not raising — guard against premature fundraising distraction and keep capital posture defensive until there's a paid signal |
| `cmo` | marketing | L·III |  | dev_tools_narrative: position Logcolor for backend engineers drowning in log noise; no demand-gen spend pre-product |
| `cmo.advocacy` | marketing | L·IV |  | open_core_community: Logcolor's advocacy KPIs are GitHub stars, early contributors, and engaged backend-engineer followers — not MQLs |
| `cmo.brand` | marketing | L·IV |  | activate_early: build the Logcolor narrative now — a credible technical POV on why backend log noise is a solvable problem, published before v0 ships |
| `coo` | ops | L·III |  | minimal_stack: claude-code + telegram + github only; keep Logcolor's ops surface small and solo-operable |
| `coo.connector` | ops | L·IV |  | minimal_connector_set: Logcolor runs on claude-code + telegram + github only; keep the surface narrow and resolve any connector drift immediately |
| `coo.health` | ops | L·IV |  | solo_operator_health: monitor Logcolor's single-operator swarm — flag connector failures and agent stalls fast, since there's no backup human |
| `coo.observability` | ops | L·IV |  | swarm_only_observability: no product to observe yet — focus on Logcolor's own agent pipeline health and interview/GitHub signal flow |
| `coo.scheduler` | ops | L·IV |  | async_telegram_cadence: Logcolor's operator checks in via Telegram — batch nudges, avoid paging, respect solo-founder focus blocks |
| `cpo` | product | L·III |  | pre_product_validation: Logcolor is idea-only — drive problem interviews with backend engineers and sharpen the 'log noise reduction' hypothesis before spec work |
| `cpo.roadmap` | product | L·IV |  | validation_roadmap: Logcolor's roadmap is sequenced around problem-validation milestones, not feature rollout — smallest slice that proves log-noise reduction wins |
| `cro` | revenue | L·III |  | no_gtm_yet: Logcolor has no sales motion — stand watch, surface design-partner signals from Telegram/GitHub, do not push pipeline |

### Standby (2) — waiting on connectors

| Agent | Waiting on |
|---|---|
| `cdo.signal` | mixpanel or supabase |
| `cdo.telemetry` | mixpanel or supabase |

### Parked (13) — not needed yet

| Agent | Unpark condition |
|---|---|
| `cdo.attribute` | Paying customers present (so there is something to attribute) |
| `cfo.forecast` | Stage reaches 10k_100k_mrr (forecast becomes actionable) |
| `cfo.treasury` | First paying customer (product_state=live_paying_customers) |
| `cmo.content` | Content-led or inbound motion adopted |
| `cmo.demand` | Operator adopts a GTM motion (pillar_4.lead_source != none_yet) |
| `coo.dashboard` | Stage reaches 10k_100k_mrr (dashboard becomes load-bearing for Board communication) |
| `coo.memory` | Operator ships a product (something to remember about) |
| `cpo.build` | Operator ships their first product (has_product=true) |
| `cpo.growth` | Product is live with users to activate |
| `cro.close` | Sales motion becomes assisted_demo or high_touch_enterprise |
| `cro.demo` | Sales motion becomes assisted_demo or high_touch_enterprise |
| `cro.expansion` | First paying customers present (product_state=live_paying_customers) |
| `cro.outbound` | Outbound sales motion adopted (gtm_profile_enum starts with OUTBOUND_) |

### Disabled (2) — not relevant

| Agent | Reason |
|---|---|
| `cfo.econ` | Pre-revenue — no LTV/CAC ratio to defend yet |
| `cpo.qa` | No product to QA yet |

### Spawn eligibility (S+)

- **`cdo.infer`** — At idea_only stage, hypothesis synthesis from interviews and GitHub/Telegram signal is the bottleneck — parallel inference instances will plausibly be justified within 30 cycles

## Phase 4 · Workflow manifest

*Source: T2 · onboarding/phase-4*

- Agent workflows: 16
- Bundle workflows: 5
- Dry-run gates: **6**
- T2 patches applied: **5**

### T2 patches — per-agent attribution

| Agent | Changed | Pillar signal | Rationale |
|---|---|---|---|
| `cmo.advocacy` | on_fire | `pillar_2.gtm_profile=BOOTSTRAP_NO_GTM` | Logcolor is idea_only with BOOTSTRAP_NO_GTM and no closed deals yet, so watching for closed deals is premature; shift the advocacy loop to sourcing design-partner candidates from GitHub/dev communities to generate the first proof points. |
| `cmo.brand` | on_fire | `pillar_6.tone=technical + pillar_1.product_maturity=ga(idea_only stage)` | For a solo-founder idea_only dev-observability tool with a technical tone and no GTM, brand work should be pre-launch build-in-public technical content rather than generic artifacts — anchor the loop on GitHub/dev-channel posts that show th |
| `cpo.roadmap` | on_fire | `pillar_2.primary_acquisition=unspecified + pillar_5.differentiator=reduce log noise for backend engineers` | Logcolor is idea_only with no discovered acquisition channel, so the roadmap agent's highest-leverage loop is turning design-partner and GitHub-issue signals into the next backend-engineer-facing capability rather than publishing generic ar |
| `cfo.capital` | on_fire, escalation | `pillar_2.gtm_profile=BOOTSTRAP_NO_GTM + pillar_4.revenue_model=subscription(pre-revenue)` | A bootstrap solo founder at idea_only has no revenue to reallocate across — the meaningful capital signal is burn vs. runway on free-tier AI/infra, so reframe the loop around cost-per-agent-run and hard budget enforcement rather than margin |
| `ceo.orchestrator` | on_fire | `pillar_2.primary_acquisition=unspecified` | At idea_only with no GTM, the CEO loop should bias exploration toward discovering a first acquisition channel and first design partner rather than allocating attention across mature bundles — anchor it on founder-visible narrative via teleg |

### Bundle workflows

| Bundle | Owner | Cycle | KPIs moved |
|---|---|---|---|
| Customer insight & activation | `cpo.growth` | 24h | activation_rate, ttv_hours, nrr |
| Pipeline & conversion | `cro.chief` | 1w | cac, sales_cycle_days, win_rate, mrr |
| Retention & expansion | `cro.expansion` | per-account | nrr, grr, referral_rate, mrr, inbound_quality |
| Efficiency & runway | `cfo.capital` | 1d | burn_multiple, cac_payback_months, cac |
| Positioning & narrative | `cmo.brand` | 1mo | narrative_strength, inbound_quality, sales_cycle_days, win_rate |

### Active-agent workflows (16)

**`ceo.orchestrator`** — heartbeat 15m

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | read_kpi_state_vector | T0 | TLM | — | — |
| 2 | compute_flywheel_score | T0 | — | — | — |
| 3 | oscillate_toward_channel_discovery | T0 | — | — | — |
| 4 | allocate_bundle_attention | T2 | ASN | — | — |
| 5 | emit_bundle_asn_to_csuite | T2 | ASN | — | — |
| 6 | emit_founder_cycle_note | T2 | TLM | gated | telegram |

_Escalations:_
- `flywheel_score_lost_criticality` → `board`
- `mc_winner_differs_3_cycles` → `board`
- `cfo.capital.runway_alert` → `board`

**`cpo`** — heartbeat 1h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | read_tlm_from_subagents | T0 | TLM | — | — |
| 2 | synthesize_dept_state | T1 | — | — | — |
| 3 | emit_asn_to_subagents | T2 | ASN | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `ceo.orchestrator`

**`cmo`** — heartbeat 1h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | read_tlm_from_subagents | T0 | TLM | — | — |
| 2 | synthesize_dept_state | T1 | — | — | — |
| 3 | emit_asn_to_subagents | T2 | ASN | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `ceo.orchestrator`

**`cro`** — heartbeat 1h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | read_tlm_from_subagents | T0 | TLM | — | — |
| 2 | synthesize_dept_state | T1 | — | — | — |
| 3 | emit_asn_to_subagents | T2 | ASN | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `ceo.orchestrator`

**`cfo`** — heartbeat 1h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | read_tlm_from_subagents | T0 | TLM | — | — |
| 2 | synthesize_dept_state | T1 | — | — | — |
| 3 | emit_asn_to_subagents | T2 | ASN | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `ceo.orchestrator`

**`cdo`** — heartbeat 1h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | read_tlm_from_subagents | T0 | TLM | — | — |
| 2 | synthesize_dept_state | T1 | — | — | — |
| 3 | emit_asn_to_subagents | T2 | ASN | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `ceo.orchestrator`

**`coo`** — heartbeat 1h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | read_tlm_from_subagents | T0 | TLM | — | — |
| 2 | synthesize_dept_state | T1 | — | — | — |
| 3 | emit_asn_to_subagents | T2 | ASN | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `ceo.orchestrator`

**`cpo.roadmap`** — heartbeat 1d

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | read_asn_from_cpo | T0 | ASN | — | — |
| 2 | ingest_design_partner_and_issue_signals | T0 | TLM | — | github |
| 3 | draft_next_capability_spec | T1 | — | — | — |
| 4 | technical_voice_gate | T2 | — | — | — |
| 5 | open_tracking_issue | T2 | VAL | gated | github |
| 6 | emit_val_to_cpo | T0 | VAL | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `cpo`

**`cmo.brand`** — heartbeat 1d

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | read_asn_from_chief | T0 | ASN | — | — |
| 2 | draft_build_in_public_post | T1 | — | — | — |
| 3 | technical_voice_gate | T2 | — | — | — |
| 4 | publish_to_github_readme_and_channels | T2 | VAL | gated | github |
| 5 | emit_val_to_cmo | T0 | VAL | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `cmo`

**`cmo.advocacy`** — heartbeat 6h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | scan_github_for_backend_log_noise_signals | T0 | TLM | — | github |
| 2 | shortlist_design_partner_candidates | T1 | — | — | — |
| 3 | draft_technical_outreach | T1 | — | — | — |
| 4 | send_outreach_for_design_partners | T2 | VAL | gated | telegram |
| 5 | emit_val_to_cmo | T0 | VAL | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `cmo`

**`cfo.capital`** — heartbeat 1h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | pull_agent_run_costs | T0 | TLM | — | — |
| 2 | detect_cost_drift | T0 | — | — | — |
| 3 | draft_budget_reallocation | T1 | — | — | — |
| 4 | narrate_burn_update_for_founder | T2 | TLM | gated | telegram |
| 5 | enforce_new_budgets | T0 | CON | gated | — |

_Escalations:_
- `projected_runway_under_90d` → `ceo.orchestrator`
- `single_agent_exceeds_2x_budget` → `cfo`

**`cdo.infer`** — heartbeat 6h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | pull_recent_telemetry | T0 | TLM | — | — |
| 2 | classify_or_score | T1 | — | — | — |
| 3 | synthesize_insight | T2 | — | — | — |
| 4 | emit_tlm_to_chief | T0 | TLM | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `cdo`

**`coo.health`** — heartbeat 15m

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | run_check | T0 | — | — | — |
| 2 | summarize_if_anomaly | T1 | — | — | — |
| 3 | emit_tlm_to_coo | T0 | TLM | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `coo`

**`coo.connector`** — heartbeat 1h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | run_check | T0 | — | — | — |
| 2 | summarize_if_anomaly | T1 | — | — | — |
| 3 | emit_tlm_to_coo | T0 | TLM | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `coo`

**`coo.scheduler`** — heartbeat 15m

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | run_check | T0 | — | — | — |
| 2 | summarize_if_anomaly | T1 | — | — | — |
| 3 | emit_tlm_to_coo | T0 | TLM | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `coo`

**`coo.observability`** — heartbeat 1h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | run_check | T0 | — | — | — |
| 2 | summarize_if_anomaly | T1 | — | — | — |
| 3 | emit_tlm_to_coo | T0 | TLM | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `coo`

### Dry-run gates (6)

- `ceo.orchestrator.emit_founder_cycle_note`
- `cfo.capital.enforce_new_budgets`
- `cfo.capital.narrate_burn_update_for_founder`
- `cmo.advocacy.send_outreach_for_design_partners`
- `cmo.brand.publish_to_github_readme_and_channels`
- `cpo.roadmap.open_tracking_issue`

## Finalize · strategy review

### Monte Carlo winner
- **Strategy:** Retention-led _(RETENTION_FIRST)_
- _Expand and protect existing customers before growing top of funnel_
- **Mode:** `pre_scale`
- At pre-scale operators the simulator holds MRR flat — the number that matters is capital preservation. Runway is **high** (p(ruin) 0%).

**Rationale:**
> RETENTION_FIRST wins on capital preservation: p(ruin) 0%, mean activation-rate growth 17.6% over horizon. MRR is held flat at this stage — compounding dynamics haven't started yet.

### Imprint review

> Logcolor is a solo-founder project aimed at reducing log noise for backend engineers, with engineering managers at 50–500 person companies as the stated buyer. The product state is idea_only: nothing is built yet, there is no revenue, and the GTM profile is BOOTSTRAP_NO_GTM, meaning no paid acquisition, no sales motion, and no marketing surface is assumed to exist. The swarm has been configured against that reality rather than against a future state.
>
> Of 33 agents, 16 are active, 13 are parked, and 2 are disabled. The parked set — cpo.build, cpo.growth, cmo.demand, cmo.content, cro.outbound, cro.demo, cro.close, cro.expansion, cfo.forecast, cfo.treasury, cdo.attribute, coo.memory, and coo.dashboard — covers the roles that require a product, pipeline, or revenue base to do meaningful work; they are held in reserve until there is something to sell, measure, or forecast. cpo.qa and cfo.econ are disabled outright: no product to QA, no unit economics to model. Required connectors are claude-code and telegram, with github suggested. Board comms run through a single Telegram channel (all_to_one_channel), so every agent writes to the same operator-visible stream.
>
> The Monte Carlo winner is RETENTION_FIRST, which at this stage is a placeholder rather than a live bet — with no users and no MRR, the strategy reduces to "do not chase growth before there is something to retain." The numbers reflect that: Sharpe is 0.00, 30-cycle mean MRR growth is 0%, p(auto-catalytic) and p(ruin) are both 0%, and cycles-to-critical is undefined. The read is that the system has no risk and no momentum because there is no product surface generating either.
>
> Dry-run opens on 2026-05-06 and closes 2026-05-20, a 14-day window during which 6 tasks across the swarm are gated — they will plan, draft, and queue work but will not write to external systems until the operator approves. Before the window closes, the operator should review those 6 gated tasks, confirm the claude-code and telegram connectors are live, decide whether to add the suggested github connector, and explicitly release any tasks that should begin performing writes when dry-run ends.

### Dry-run window
- Dry-run on: **true** · expires **2026-05-06T13:53:38.638Z**
- Manifest hash: `sha256:7ae42b3dc8161f1c8254eb96ad96dcf83377a3fb084e08ca75b4f76bda92cd52`

## Run metadata

| Phase | Elapsed (ms) |
|---|---:|
| pillar_1_ms | 2 |
| pillar_2_ms | 0 |
| pillar_3_5_ms | 1 |
| phase_2_ms | 9227 |
| phase_3_ms | 38994 |
| phase_4_ms | 42715 |
| finalize_ms | 20531 |
| **Total T2 calls** | **4** |

