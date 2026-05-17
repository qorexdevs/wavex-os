# Variant report · vm06-marketplace-prerevenue

*Pipeline mode:* **LIVE T2**
*Fixture description:* Validation matrix F6 · Two-sided marketplace, pre-revenue soft launch. Expected: pre_scale MC, cmo.brand active early, build+activation emphasis.

## Operator inputs (Pillars 1–5)

- **Company:** Arenafly · `https://arenafly.example`
- **Claude plan:** max_5x
- **Stage:** built_not_selling · Soft-launched
- **Lead sources:** content_seo, events, other
- **Sales motion:** assisted_demo
- **Board comms:** telegram · digest_plus_urgent_phone

## Phase 1 · Pillar 1 enrichment

- **Enrichment status:** `enriched`
- **Industry hint:** marketplace
- **Business model:** marketplace
- **Has product:** yes
- **Ideal customer profile:** two-sided marketplace participants
- **Revenue model:** take-rate marketplace
- **Competitive position:** unvalidated
- **Primary acquisition channel:** unspecified
- **Product maturity signal:** pre_mvp
- **Tone signal:** friendly
- **Primary friction hypothesis:** friction point not clearly specified — infer from GTM stage
- **Differentiator hypothesis:** Two-sided marketplace connecting independent fitness instructors with local venues

**Company context:**
> Two-sided marketplace connecting independent fitness instructors with local venues. Soft-launched last month in one city, no transactions yet. Business idea validated but no paying customers. Free during beta.

## Phase 2 · Connector manifest

*Source: T2 · onboarding/phase-2*

| Bucket | Count | Connectors |
|---|---:|---|
| Required | 4 | `claude-code`, `github`, `telegram`, `mixpanel` |
| Suggested | 1 | `supabase` |
| Deferred | 0 | — |
| Blocked on approval | 0 | — |

### Required — details

| ID | Priority | Status | Dry-run | Rationale |
|---|---|---|---|---|
| Claude Code (inference) | P-1 | configured | — | Inference bootstrap for Arenafly — verified on max_5x plan during Pillar 2. |
| GitHub (code + ship events) | P1 | pending_credential | — | Arenafly is built_not_selling — cpo watches merges to correlate ships with first-transaction activation. |
| Telegram (Board notifications) | P0 | pending_credential | no | Operator chose Telegram with digest+urgent-phone routing for CEO notifications. |
| Mixpanel (product analytics) | P0 | pending_decision | — | CONTENT_LED_PLG profile — content→instructor/venue signup attribution is load-bearing for Arenafly soft-launch. |

### Suggested — details

| ID | Priority | Status | Rationale |
|---|---|---|---|
| Supabase (data + auth) | P0 | pending_decision | Soft-launched marketplace with no transactions — stand up event store before take-rate revenue starts flowing. |

## Phase 3 · Swarm manifest

*Source: T2 · onboarding/phase-3*

### Topology
- Total base roster: **33**
- Active: **23**
- Standby: 0
- Parked: 9
- Disabled: 1

### Bundle allocation

| Bundle | Weight |
|---|---:|
| Customer insight & activation | 24% |
| Pipeline & conversion | 17% |
| Retention & expansion | 20% |
| Efficiency & runway | 17% |
| Positioning & narrative | 22% |

### Active agents (23)

| Agent | Department | Level | S+ | Skill overlay |
|---|---|---|:-:|---|
| `ceo.orchestrator` | ceo | L·II |  | Orchestrate Arenafly's pre-MVP soft launch: sequence marketplace supply (venues) and demand (instructors) work, hold the team to content-led PLG focus |
| `cdo` | data | L·III |  | Stand up Mixpanel-based marketplace funnel telemetry (instructor signup, venue listing, booking) for Arenafly soft launch |
| `cdo.infer` | data | L·IV | ✓ | Infer marketplace liquidity bottlenecks for Arenafly from sparse soft-launch data; flag supply/demand imbalance early |
| `cdo.signal` | data | L·IV | ✓ | Surface qualitative signal from Telegram + design-partner conversations to inform Arenafly product and GTM bets |
| `cdo.telemetry` | data | L·IV |  | Wire Mixpanel events for Arenafly's two-sided funnel: instructor signup, venue listing, search, booking attempt, booking complete |
| `cfo` | finance | L·III |  | Pre-revenue Arenafly: defend runway, model take-rate sensitivity, prepare for first GMV |
| `cfo.capital` | finance | L·IV |  | Manage Arenafly runway pre-revenue; model capital needs to reach marketplace liquidity threshold |
| `cmo` | marketing | L·III |  | Drive Arenafly's content-led PLG positioning to fitness instructors and gym owners; lean on founder network warm intros |
| `cmo.brand` | marketing | L·IV |  | activate_early: shape Arenafly's narrative as the marketplace for independent fitness instructors and local venues while waiting for PMF |
| `cmo.content` | marketing | L·IV | ✓ | weight_up: primary demand driver — produce SEO content for instructors and gym owners; this is Arenafly's main acquisition lever |
| `cmo.demand` | marketing | L·IV | ✓ | ad_bidding_workflows_disabled: no ad-platform connector in Arenafly manifest — focus on owned/earned demand for fitness ICP |
| `coo` | ops | L·III |  | Operate Arenafly's lean stack: GitHub, Telegram, Mixpanel, Supabase — keep the swarm humming on a small footprint |
| `coo.connector` | ops | L·IV |  | Maintain Arenafly's required connectors (claude-code, github, telegram, mixpanel) plus suggested supabase; flag missing ad-platform if paid demand emerges |
| `coo.health` | ops | L·IV |  | Monitor Arenafly swarm health on its lean connector set (claude-code, github, telegram, mixpanel, supabase) |
| `coo.memory` | ops | L·IV |  | Maintain Arenafly org memory: ICP nuances, venue conversations, instructor feedback, marketplace-specific learnings |
| `coo.observability` | ops | L·IV |  | Observe Arenafly's pre-MVP swarm activity; keep visibility high while volume is low |
| `coo.scheduler` | ops | L·IV |  | Schedule Arenafly swarm cadence around founder's Telegram availability and design-partner feedback loops |
| `cpo` | product | L·III |  | Own Arenafly marketplace product strategy through soft-launch — prioritize matching/booking core over breadth |
| `cpo.build` | product | L·IV | ✓ | Ship Arenafly marketplace iterations through claude-code + GitHub against design-partner feedback |
| `cpo.roadmap` | product | L·IV |  | Sequence Arenafly roadmap around two-sided liquidity: prove venue density before scaling instructor acquisition |
| `cro` | revenue | L·III |  | Run assisted-demo motion via phone/video for Arenafly's first venue and instructor design partners |
| `cro.close` | revenue | L·IV |  | Close Arenafly design-partner venues and seed instructor cohort via warm founder-network intros |
| `cro.demo` | revenue | L·IV |  | Run assisted demos for Arenafly venues and instructors over phone/video; tailor pitch to two-sided value prop |

### Parked (9) — not needed yet

| Agent | Unpark condition |
|---|---|
| `cdo.attribute` | Paying customers present (so there is something to attribute) |
| `cfo.forecast` | Stage reaches 10k_100k_mrr (forecast becomes actionable) |
| `cfo.treasury` | First paying customer (product_state=live_paying_customers) |
| `cmo.advocacy` | Stage reaches 100k_1m_mrr or referral motion adopted |
| `coo.dashboard` | Stage reaches 10k_100k_mrr (dashboard becomes load-bearing for Board communication) |
| `cpo.growth` | Product is live with users to activate |
| `cpo.qa` | First paying customer (product_state=live_paying_customers) |
| `cro.expansion` | First paying customers present (product_state=live_paying_customers) |
| `cro.outbound` | Outbound sales motion adopted (gtm_profile_enum starts with OUTBOUND_) |

### Disabled (1) — not relevant

| Agent | Reason |
|---|---|
| `cfo.econ` | Pre-revenue — no LTV/CAC ratio to defend yet |

### Spawn eligibility (S+)

- **`cpo.build`** — Pre-MVP marketplace iteration queue will justify parallel build spawns
- **`cmo.content`** — Content-led PLG with no paid channel — content output is Arenafly's primary demand lever and warrants spawn parallelism
- **`cdo.telemetry`** — Mixpanel funnel instrumentation across two-sided marketplace events is high-volume setup work
- **`cdo.signal`** — Heavy qualitative signal volume from Telegram + warm-intro conversations during soft launch

## Phase 4 · Workflow manifest

*Source: T2 · onboarding/phase-4*

- Agent workflows: 23
- Bundle workflows: 5
- Dry-run gates: **11**
- T2 patches applied: **9**

### T2 patches — per-agent attribution

| Agent | Changed | Pillar signal | Rationale |
|---|---|---|---|
| `cmo.demand` | on_fire, escalation | `pillar_2.product_maturity=pre_mvp + pillar_3.primary_acquisition=unspecified + pillar_1.icp=two-sided marketplace partic` | Arenafly is a pre-MVP two-sided marketplace with no acquisition channel specified, so cmo.demand should not be pulling/scoring/sending outbound — it should be discovering supply-side (instructors) and demand-side (venues) seed lists and sur |
| `cro.demo` | on_fire, escalation | `pillar_2.product_maturity=pre_mvp + pillar_4.revenue_model=take-rate marketplace` | Pre-MVP marketplace has no pipeline queue to read — cro.demo should be running discovery conversations with both instructors and venues to validate take-rate willingness, not executing demos. |
| `cro.close` | on_fire, escalation | `pillar_2.product_maturity=pre_mvp + pillar_4.revenue_model=take-rate marketplace` | At pre-MVP with no product to close on, cro.close should be converting validated discovery contacts into design-partner / waitlist commitments rather than running a deal pipeline. |
| `cpo.build` | on_fire, escalation | `pillar_2.product_maturity=pre_mvp + pillar_5.differentiator=Two-sided marketplace connecting independent fitness instruc` | Pre-MVP build agent should be scoping the smallest two-sided matching loop (instructor lists venue slot → venue confirms → take-rate captured) rather than 'drafting and publishing artifacts' — the differentiator IS the matching mechanic. |
| `cmo.content` | on_fire | `pillar_3.gtm=CONTENT_LED_PLG + pillar_0.build_posture=built_not_selling + pillar_6.tone=friendly` | GTM is content_led_plg with a friendly built_not_selling tone, so content output should be build-in-public narrative (instructor stories, venue spotlights, marketplace-creation journal) rather than generic artifact drafting. |
| `cdo.signal` | on_fire | `pillar_1.icp=two-sided marketplace participants + pillar_4.revenue_model=take-rate marketplace` | For a two-sided marketplace at pre-MVP, the only meaningful signal is liquidity (supply/demand balance and time-to-first-match), not generic telemetry classification — cdo.signal should compute marketplace health metrics specifically. |
| `cdo.telemetry` | on_fire | `pillar_2.product_maturity=pre_mvp + pillar_1.icp=two-sided marketplace participants (dual identity) + connector=mixpanel` | At pre-MVP with mixpanel configured but no product to instrument yet, cdo.telemetry should focus on instrumentation-readiness (event spec, identity model for two-sided users) rather than pulling telemetry that doesn't exist. |
| `cfo.capital` | on_fire | `pillar_2.product_maturity=pre_mvp + pillar_4.revenue_model=take-rate marketplace (no revenue yet)` | Pre-MVP take-rate marketplace has zero revenue and likely solo-operator burn — capital agent should focus on runway-vs-time-to-first-match, not enforcing reallocations across agents that have no spend. |
| `ceo.orchestrator` | on_fire | `pillar_2.product_maturity=pre_mvp + pillar_1.icp=two-sided marketplace participants + pillar_5.differentiator=Two-sided ` | At pre-MVP the orchestrator's flywheel score must be the cold-start liquidity score (matched-pairs growth), not a generic KPI vector — and it should bias attention toward the bottleneck side surfaced by cdo.signal. |

### Bundle workflows

| Bundle | Owner | Cycle | KPIs moved |
|---|---|---|---|
| Customer insight & activation | `cpo.growth` | 24h | activation_rate, ttv_hours, nrr |
| Pipeline & conversion | `cro.chief` | 1w | cac, sales_cycle_days, win_rate, mrr |
| Retention & expansion | `cro.expansion` | per-account | nrr, grr, referral_rate, mrr, inbound_quality |
| Efficiency & runway | `cfo.capital` | 1d | burn_multiple, cac_payback_months, cac |
| Positioning & narrative | `cmo.brand` | 1mo | narrative_strength, inbound_quality, sales_cycle_days, win_rate |

### Active-agent workflows (23)

**`ceo.orchestrator`** — heartbeat 15m

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | read_kpi_state_vector | T0 | TLM | — | — |
| 2 | compute_cold_start_flywheel_score | T0 | TLM | — | — |
| 3 | allocate_bundle_attention_to_bottleneck_side | T2 | ASN | — | — |
| 4 | oscillate_explore | T0 | TLM | — | — |
| 5 | emit_bundle_asn_to_csuite | T2 | ASN | — | — |
| 6 | emit_cycle_narrative_to_operator | T2 | TLM | gated | telegram |

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

**`cpo.build`** — heartbeat 2h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | read_asn_from_chief | T0 | ASN | — | — |
| 2 | scope_minimum_matching_loop | T1 | TLM | — | — |
| 3 | draft_build_artifact_or_concierge_workflow | T1 | VAL | — | github |
| 4 | open_pr_or_publish_runbook | T2 | VAL | gated | github |
| 5 | emit_val_to_chief | T0 | VAL | — | — |

_Escalations:_
- `matching_loop_blocked_by_unknown` → `cpo`
- `first_match_completed` → `ceo.orchestrator`

**`cpo.roadmap`** — heartbeat 1d

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | read_asn_from_chief | T0 | ASN | — | — |
| 2 | draft_artifact | T1 | — | — | — |
| 3 | brand_voice_gate | T2 | — | — | — |
| 4 | publish_or_ship | T2 | VAL | gated | github |
| 5 | emit_val_to_chief | T0 | VAL | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `cpo`

**`cmo.demand`** — heartbeat 2h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | discover_seed_supply_and_demand_lists | T1 | TLM | — | — |
| 2 | propose_acquisition_channel_hypotheses | T2 | ASN | — | — |
| 3 | draft_personalized_outreach_for_review | T1 | VAL | gated | telegram |
| 4 | emit_val_to_chief | T0 | VAL | — | — |

_Escalations:_
- `no_seed_list_traction_after_2_cycles` → `cmo`
- `operator_picks_channel` → `ceo.orchestrator`

**`cmo.content`** — heartbeat 4h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | read_asn_from_chief | T0 | ASN | — | — |
| 2 | mine_build_in_public_moments | T1 | TLM | — | github |
| 3 | draft_content_in_friendly_voice | T1 | VAL | — | — |
| 4 | brand_voice_gate | T2 | VAL | gated | — |
| 5 | queue_for_operator_publish | T2 | VAL | gated | telegram |
| 6 | emit_val_to_chief | T0 | VAL | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `cmo`

**`cmo.brand`** — heartbeat 1d

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | read_asn_from_chief | T0 | ASN | — | — |
| 2 | draft_artifact | T1 | — | — | — |
| 3 | brand_voice_gate | T2 | — | — | — |
| 4 | publish_or_ship | T2 | VAL | gated | — |
| 5 | emit_val_to_chief | T0 | VAL | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `cmo`

**`cro.demo`** — heartbeat 4h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | identify_discovery_call_candidates | T1 | TLM | — | — |
| 2 | prepare_two_sided_discovery_brief | T2 | ASN | — | — |
| 3 | draft_outreach_for_operator_send | T2 | VAL | gated | telegram |
| 4 | log_discovery_outcomes_tlm | T0 | TLM | — | supabase |

_Escalations:_
- `5_consistent_no_pain_signals` → `cpo`
- `willingness_to_pay_validated` → `cro`

**`cro.close`** — heartbeat 2h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | read_validated_discovery_contacts | T0 | TLM | — | supabase |
| 2 | prepare_design_partner_offer | T2 | ASN | — | — |
| 3 | draft_commitment_request | T2 | VAL | gated | telegram |
| 4 | log_commitment_outcome | T0 | TLM | — | supabase |

_Escalations:_
- `supply_demand_imbalance_>3x` → `cmo`
- `design_partner_cohort_full` → `cpo.build`

**`cfo.capital`** — heartbeat 1h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | compute_runway_and_burn | T0 | TLM | — | — |
| 2 | compute_attention_roi_per_agent | T0 | TLM | — | — |
| 3 | detect_drift | T0 | TLM | — | — |
| 4 | draft_reallocation_toward_liquidity | T1 | TLM | — | — |
| 5 | narrate_runway_for_operator | T2 | TLM | — | telegram |
| 6 | propose_budget_change | T1 | CON | gated | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `cfo`
- `burn_multiple_gt_2_5 || runway_lt_12mo` → `ceo.orchestrator`

**`cdo.signal`** — heartbeat 1h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | pull_marketplace_side_counts | T0 | TLM | — | supabase |
| 2 | compute_liquidity_metrics | T1 | TLM | — | — |
| 3 | detect_cold_start_imbalance | T1 | TLM | — | — |
| 4 | synthesize_liquidity_insight | T2 | TLM | — | — |
| 5 | emit_tlm_to_chief | T0 | TLM | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `cdo`

**`cdo.telemetry`** — heartbeat 2h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | audit_instrumentation_coverage | T0 | TLM | — | mixpanel |
| 2 | draft_two_sided_event_spec | T1 | TLM | — | — |
| 3 | propose_instrumentation_pr | T2 | VAL | gated | github |
| 4 | emit_tlm_to_chief | T0 | TLM | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `cdo`

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

**`coo.memory`** — heartbeat 1d

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

### Dry-run gates (11)

- `cdo.telemetry.propose_instrumentation_pr`
- `ceo.orchestrator.emit_cycle_narrative_to_operator`
- `cfo.capital.propose_budget_change`
- `cmo.brand.publish_or_ship`
- `cmo.content.brand_voice_gate`
- `cmo.content.queue_for_operator_publish`
- `cmo.demand.draft_personalized_outreach_for_review`
- `cpo.build.open_pr_or_publish_runbook`
- `cpo.roadmap.publish_or_ship`
- `cro.close.draft_commitment_request`
- `cro.demo.draft_outreach_for_operator_send`

## Finalize · strategy review

### Monte Carlo winner
- **Strategy:** Retention-led _(RETENTION_FIRST)_
- _Expand and protect existing customers before growing top of funnel_
- **Mode:** `pre_scale`
- At pre-scale operators the simulator holds MRR flat — the number that matters is capital preservation. Runway is **high** (p(ruin) 0%).

**Rationale:**
> RETENTION_FIRST wins on capital preservation: p(ruin) 0%, mean activation-rate growth 17.6% over horizon. MRR is held flat at this stage — compounding dynamics haven't started yet.

### Imprint review

> Arenafly is a two-sided marketplace connecting independent fitness instructors with local venues. It soft-launched last month in a single city and has not processed a transaction yet; the product is built but not selling, and the beta is free. The business idea is validated but there are no paying customers. The GTM motion is content-led PLG, which fits a marketplace trying to seed supply and demand without a paid sales layer during beta.
>
> The swarm runs 23 of 33 agents active, with 9 parked and 1 disabled. Parks concentrate in functions that require scale or spend Arenafly does not yet have: cpo.qa and cpo.growth, cmo.advocacy, cro.outbound and cro.expansion, cfo.forecast and cfo.treasury, cdo.attribute, and coo.dashboard. cfo.econ is disabled outright, consistent with a pre-revenue unit-economics function that has nothing to measure. The connector stack is claude-code, github, telegram, and mixpanel, with supabase suggested. Board communications route through Telegram as a digest plus urgent phone escalation. Claude Code is verified on the max_5x plan.
>
> The Monte Carlo winner is RETENTION_FIRST, meaning the swarm prioritizes keeping the instructors and venues already in the beta engaged before chasing new acquisition or monetization. The 30-cycle simulation returned a mean MRR growth of 0%, a Sharpe of 0.00, a 0% probability of auto-catalytic growth, and a 0% probability of ruin, with cycles-to-critical undefined. In plain terms: at the pre-revenue, free-beta stage the model has no monetary signal to differentiate strategies, so it selected the lowest-risk posture — protect the early cohort, do not force growth, do not spend into uncertainty.
>
> The dry-run window runs 14 days starting 2026-05-06. Eleven tasks across the swarm are held dry and will surface as approval prompts rather than executing directly. Before writes go live, the operator needs to review and approve those 11 gated tasks, confirm the four required connectors (claude-code, github, telegram, mixpanel) are authenticated, and decide whether to add supabase. After the 14 days, agents with clean dry-run records graduate to live execution; anything still contested stays gated until the operator clears it.

### Dry-run window
- Dry-run on: **true** · expires **2026-05-06T14:03:55.550Z**
- Manifest hash: `sha256:27844cb84d48b83b1254397f00cc4e93a2288864e856b5961c95c818616d4935`

## Run metadata

| Phase | Elapsed (ms) |
|---|---:|
| pillar_1_ms | 1 |
| pillar_2_ms | 0 |
| pillar_3_5_ms | 2 |
| phase_2_ms | 10145 |
| phase_3_ms | 37940 |
| phase_4_ms | 79650 |
| finalize_ms | 15748 |
| **Total T2 calls** | **4** |

