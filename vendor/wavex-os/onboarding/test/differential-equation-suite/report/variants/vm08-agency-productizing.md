# Variant report · vm08-agency-productizing

*Pipeline mode:* **LIVE T2**
*Fixture description:* Validation matrix F8 · Agency productizing to SaaS — ambiguous state. Expected: pre_scale MC despite agency revenue, validation focus for product.

## Operator inputs (Pillars 1–5)

- **Company:** Halfscope Studio · `https://halfscope.example`
- **Claude plan:** max_20x
- **Stage:** built_not_selling · Pre-launch
- **Lead sources:** referral_word_of_mouth
- **Sales motion:** high_touch_enterprise
- **Board comms:** slack · digest_plus_urgent_phone

## Phase 1 · Pillar 1 enrichment

- **Enrichment status:** `enriched`
- **Industry hint:** services_to_saas
- **Business model:** subscription
- **Has product:** yes
- **Ideal customer profile:** unspecified
- **Revenue model:** subscription
- **Competitive position:** unvalidated
- **Primary acquisition channel:** unspecified
- **Product maturity signal:** ga
- **Tone signal:** technical
- **Primary friction hypothesis:** friction point not clearly specified — infer from GTM stage
- **Differentiator hypothesis:** Performance marketing agency billing $180k/mo, 12 people, now building an AI bid-management tool based on agency playbooks

**Company context:**
> Performance marketing agency billing $180k/mo, 12 people, now building an AI bid-management tool based on agency playbooks. Tool in beta with own clients. Agency is current revenue; tool is the future.

## Phase 2 · Connector manifest

*Source: T2 · onboarding/phase-2*

| Bucket | Count | Connectors |
|---|---:|---|
| Required | 3 | `claude-code`, `github`, `slack` |
| Suggested | 2 | `supabase`, `mixpanel` |
| Deferred | 0 | — |
| Blocked on approval | 0 | — |

### Required — details

| ID | Priority | Status | Dry-run | Rationale |
|---|---|---|---|---|
| Claude Code (inference) | P-1 | configured | — | Inference bootstrap for Halfscope Studio — verified on max_20x during Pillar 2. |
| GitHub (code + ship events) | P1 | pending_credential | — | Halfscope's bid-management tool is built-not-selling; join merge/deploy events to beta-client activation. |
| Slack (Board notifications) | P0 | pending_credential | no | Pillar 5 — Slack digest + urgent-phone routing chosen for CEO→operator notifications. |

### Suggested — details

| ID | Priority | Status | Rationale |
|---|---|---|---|
| Supabase (data + auth) | P0 | pending_decision | Pre-launch SaaS: stand up the event store now so product→revenue telemetry lands before GA monetization. |
| Mixpanel (product analytics) | P1 | pending_decision | Referral-led GTM + beta tool — anomaly detection on activation funnels beyond raw Supabase events. |

## Phase 3 · Swarm manifest

*Source: T2 · onboarding/phase-3*

### Topology
- Total base roster: **33**
- Active: **22**
- Standby: 0
- Parked: 10
- Disabled: 1

### Bundle allocation

| Bundle | Weight |
|---|---:|
| Customer insight & activation | 18% |
| Pipeline & conversion | 18% |
| Retention & expansion | 27% |
| Efficiency & runway | 18% |
| Positioning & narrative | 18% |

### Active agents (22)

| Agent | Department | Level | S+ | Skill overlay |
|---|---|---|:-:|---|
| `ceo.orchestrator` | ceo | L·II |  | services_to_saas_pivot: orchestrate Halfscope Studio's transition from $180k/mo agency to AI bid-management SaaS |
| `cdo` | data | L·III |  | playbook_to_signal: codify Halfscope's agency bid-management playbooks into training signal for the AI tool |
| `cdo.infer` | data | L·IV | ✓ | bid_inference_core: the AI bid-management model IS the product — prioritize inference quality on agency-derived training data |
| `cdo.signal` | data | L·IV | ✓ | agency_playbook_capture: extract Halfscope's bid-management heuristics as structured signal for the AI tool |
| `cdo.telemetry` | data | L·IV |  | pre_launch_instrumentation: wire telemetry into the AI bid-management tool before first design partner onboards |
| `cfo` | finance | L·III |  | dual_pl: separate agency services P&L from nascent SaaS P&L for Halfscope Studio |
| `cfo.capital` | finance | L·IV |  | services_funded_saas: agency cashflow ($180k/mo) funds SaaS build — track burn allocated to product |
| `cmo` | marketing | L·III |  | narrative_first: position Halfscope's agency playbooks as the differentiator for the AI bid-management product |
| `cmo.advocacy` | marketing | L·IV |  | weight_up: referral-led motion — instrument Halfscope's existing agency client roster as primary advocacy surface |
| `cmo.brand` | marketing | L·IV |  | activate_early: build Halfscope's services-to-SaaS narrative (agency-playbooks-as-AI) while pre-PMF |
| `coo` | ops | L·III |  | 12_person_studio: operate a 12-person team straddling agency delivery and SaaS build |
| `coo.connector` | ops | L·IV |  | required_stack: wire claude-code + github + slack; stage supabase + mixpanel for pre-launch data plane |
| `coo.health` | ops | L·IV |  | dual_mode_health: watch both agency delivery SLAs and SaaS build velocity across the 12-person team |
| `coo.memory` | ops | L·IV |  | playbook_memory: persist Halfscope's agency IP as retrievable context for product and GTM agents |
| `coo.observability` | ops | L·IV |  | slack_surface: route swarm observability to the operator's primary Slack channel |
| `coo.scheduler` | ops | L·IV |  | pre_launch_cadence: drive design-partner outreach cadence alongside build sprints |
| `cpo` | product | L·III |  | pre_launch_ga: Halfscope's AI bid tool is built but not selling — focus on first-design-partner readiness |
| `cpo.build` | product | L·IV | ✓ | ga_hardening: tighten AI bid-management tool for first paying design partners sourced from agency network |
| `cpo.roadmap` | product | L·IV |  | referral_feedback_loop: roadmap driven by warm-referral prospect conversations, not inbound signal |
| `cro` | revenue | L·III |  | referral_led_enterprise: convert agency client relationships into first SaaS design partners via high-touch phone/video close |
| `cro.close` | revenue | L·IV |  | high_touch_close: convert referred prospects to design partners via phone/video subscription close |
| `cro.demo` | revenue | L·IV |  | technical_demo: phone/video walkthroughs of AI bid-management for performance-marketing-literate buyers |

### Parked (10) — not needed yet

| Agent | Unpark condition |
|---|---|
| `cdo.attribute` | Paying customers present (so there is something to attribute) |
| `cfo.forecast` | Stage reaches 10k_100k_mrr (forecast becomes actionable) |
| `cfo.treasury` | First paying customer (product_state=live_paying_customers) |
| `cmo.content` | Content-led or inbound motion adopted |
| `cmo.demand` | Inbound lead source becomes primary |
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

- **`cpo.build`** — Pre-launch GA hardening — expect bursty build queues as design-partner feedback lands
- **`cdo.signal`** — Agency-playbook-to-training-signal extraction is the critical path for the AI bid-management product — parallelizable work
- **`cdo.infer`** — Bid-inference model is the product core — multiple concurrent experiments justify spawn capacity

## Phase 4 · Workflow manifest

*Source: T2 · onboarding/phase-4*

- Agent workflows: 22
- Bundle workflows: 5
- Dry-run gates: **11**
- T2 patches applied: **9**

### T2 patches — per-agent attribution

| Agent | Changed | Pillar signal | Rationale |
|---|---|---|---|
| `cmo.advocacy` | on_fire, escalation | `pillar_2.gtm=REFERRAL_LED, pillar_1.differentiator=agency_book_180k_mo` | Halfscope is REFERRAL_LED GTM with an agency-client base already billing $180k/mo, so advocacy must mine the existing 12-person agency book for case-study candidates and warm referrals rather than generic closed-won watching. |
| `cpo.build` | on_fire | `pillar_1.product=ai_bid_management_from_agency_playbooks, pillar_1.product_maturity=ga` | Halfscope is building a GA AI bid-management tool codified from their own agency playbooks, so the product build loop should pull playbook primitives from the agency itself rather than drafting generic artifacts. |
| `cro.demo` | on_fire, escalation | `pillar_2.gtm=REFERRAL_LED, pillar_3.icp=performance_marketers` | Halfscope is REFERRAL_LED selling an AI bid-management tool to performance marketers; demos must be anchored on the prospect's own ad account data rather than a generic engagement brief. |
| `cro.close` | on_fire | `pillar_2.revenue_model=subscription, pillar_2.gtm=REFERRAL_LED` | Subscription revenue model with referral-led GTM means close motion must negotiate seat/tier fit against the referrer's context rather than running a generic engagement flow. |
| `cdo.signal` | on_fire | `pillar_1.differentiator=agency_playbooks_to_ai_bid_tool` | Operator's differentiator is codifying agency playbooks into an AI bid tool, so the signal agent should mine ad-performance telemetry for playbook-violating patterns instead of generic classification. |
| `cdo.telemetry` | on_fire | `pillar_1.product_maturity=ga, pillar_1.product=ai_bid_management` | As a GA product, Halfscope's telemetry agent must watch product usage on the bid tool (activation, playbook adoption) rather than a generic pull/classify loop. |
| `cdo.infer` | on_fire | `pillar_1.differentiator=agency_book_180k_mo_as_training_data` | Halfscope's defensible asset is playbook inference from their own $180k/mo agency book, so the infer agent should learn bid-decision heuristics from historical agency outcomes rather than generic scoring. |
| `coo.connector` | on_fire, escalation | `pillar_1.product=ai_bid_management (depends on ad-platform connectors), connectors=[claude-code,github,slack,supabase,mi` | A bid-management tool is useless without live ad-platform + supabase + mixpanel links; the connector agent must specifically watchdog the ad-data pipelines that power the product, not run a generic health check. |
| `cmo` | on_fire | `pillar_2.gtm=REFERRAL_LED, pillar_4.tone=technical` | Technical tone + REFERRAL_LED GTM means the CMO loop should prioritize synthesizing referrer/advocate signal over generic subagent aggregation. |

### Bundle workflows

| Bundle | Owner | Cycle | KPIs moved |
|---|---|---|---|
| Customer insight & activation | `cpo.growth` | 24h | activation_rate, ttv_hours, nrr |
| Pipeline & conversion | `cro.chief` | 1w | cac, sales_cycle_days, win_rate, mrr |
| Retention & expansion | `cro.expansion` | per-account | nrr, grr, referral_rate, mrr, inbound_quality |
| Efficiency & runway | `cfo.capital` | 1d | burn_multiple, cac_payback_months, cac |
| Positioning & narrative | `cmo.brand` | 1mo | narrative_strength, inbound_quality, sales_cycle_days, win_rate |

### Active-agent workflows (22)

**`ceo.orchestrator`** — heartbeat 15m

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | read_kpi_state_vector | T0 | TLM | — | — |
| 2 | compute_flywheel_score | T0 | — | — | — |
| 3 | allocate_bundle_attention | T2 | — | — | — |
| 4 | oscillate_explore | T0 | — | — | — |
| 5 | emit_bundle_asn_to_csuite | T2 | ASN | — | — |
| 6 | emit_cycle_narrative_to_board | T2 | TLM | — | — |

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
| 2 | weight_referral_signal | T1 | TLM | — | — |
| 3 | synthesize_dept_state | T1 | TLM | — | — |
| 4 | emit_asn_to_subagents | T2 | ASN | gated | — |

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
| 2 | fetch_agency_playbook_rule | T1 | TLM | — | github |
| 3 | draft_bid_feature_spec | T1 | VAL | — | claude-code |
| 4 | ship_behind_flag | T2 | VAL | gated | github |
| 5 | emit_val_to_chief | T0 | VAL | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `cpo`

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

**`cmo.advocacy`** — heartbeat 6h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | pull_agency_client_roster_from_supabase | T0 | TLM | — | supabase |
| 2 | score_referral_propensity | T1 | TLM | — | — |
| 3 | draft_case_study_brief | T2 | VAL | gated | — |
| 4 | queue_referral_ask_for_cro | T2 | ASN | gated | slack |
| 5 | emit_val_to_cmo_content | T0 | VAL | — | — |

_Escalations:_
- `no_referral_candidates_30d` → `cro`
- `case_study_legal_block` → `coo`

**`cro.demo`** — heartbeat 4h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | read_pipeline_queue | T0 | TLM | — | supabase |
| 2 | pull_prospect_ad_telemetry | T1 | TLM | — | mixpanel |
| 3 | build_personalized_bid_sim | T2 | VAL | gated | claude-code |
| 4 | execute_demo_and_capture_objections | T2 | VAL | gated | slack |
| 5 | log_outcome_tlm | T0 | TLM | — | supabase |

_Escalations:_
- `prospect_no_ad_access` → `coo.connector`
- `sim_projects_negative_lift` → `cpo.build`

**`cro.close`** — heartbeat 2h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | read_pipeline_queue | T0 | TLM | — | supabase |
| 2 | compute_tier_fit | T1 | TLM | — | — |
| 3 | draft_proposal_with_referrer_leverage | T2 | VAL | gated | claude-code |
| 4 | send_proposal_and_schedule_close | T2 | VAL | gated | slack |
| 5 | log_outcome_tlm | T0 | TLM | — | supabase |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `cro`

**`cfo.capital`** — heartbeat 1h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | compute_marginal_roi_per_agent | T0 | TLM | — | — |
| 2 | detect_drift | T0 | — | — | — |
| 3 | draft_reallocation | T0 | — | — | — |
| 4 | narrate_diff_for_board | T2 | — | — | — |
| 5 | enforce_new_budgets | T0 | CON | gated | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `cfo`
- `burn_multiple_gt_2_5 || runway_lt_12mo` → `ceo.orchestrator`

**`cdo.signal`** — heartbeat 1h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | pull_bid_telemetry | T0 | TLM | — | mixpanel |
| 2 | detect_playbook_violations | T1 | TLM | — | — |
| 3 | synthesize_playbook_drift_insight | T2 | TLM | — | claude-code |
| 4 | emit_tlm_to_chief | T0 | TLM | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `cdo`

**`cdo.telemetry`** — heartbeat 2h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | pull_product_usage_from_mixpanel | T0 | TLM | — | mixpanel |
| 2 | flag_activation_stalls | T1 | TLM | — | — |
| 3 | synthesize_retention_risk_insight | T2 | TLM | — | claude-code |
| 4 | emit_tlm_to_chief | T0 | TLM | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `cdo`

**`cdo.infer`** — heartbeat 6h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | pull_historical_bid_outcomes | T0 | TLM | — | supabase |
| 2 | fit_playbook_heuristic | T1 | TLM | — | claude-code |
| 3 | synthesize_rule_promotion_proposal | T2 | TLM | — | — |
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
| 1 | probe_ad_data_pipelines | T0 | TLM | — | supabase |
| 2 | probe_mixpanel_ingest | T0 | TLM | — | mixpanel |
| 3 | summarize_if_anomaly | T1 | TLM | — | — |
| 4 | emit_tlm_to_coo | T0 | TLM | — | — |

_Escalations:_
- `ad_pipeline_stale_gt_2h` → `coo`
- `customer_account_disconnect` → `cro.close`

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

- `cfo.capital.enforce_new_budgets`
- `cmo.advocacy.draft_case_study_brief`
- `cmo.advocacy.queue_referral_ask_for_cro`
- `cmo.brand.publish_or_ship`
- `cmo.emit_asn_to_subagents`
- `cpo.build.ship_behind_flag`
- `cpo.roadmap.publish_or_ship`
- `cro.close.draft_proposal_with_referrer_leverage`
- `cro.close.send_proposal_and_schedule_close`
- `cro.demo.build_personalized_bid_sim`
- `cro.demo.execute_demo_and_capture_objections`

## Finalize · strategy review

### Monte Carlo winner
- **Strategy:** Retention-led _(RETENTION_FIRST)_
- _Expand and protect existing customers before growing top of funnel_
- **Mode:** `pre_scale`
- At pre-scale operators the simulator holds MRR flat — the number that matters is capital preservation. Runway is **high** (p(ruin) 0%).

**Rationale:**
> RETENTION_FIRST wins on capital preservation: p(ruin) 0%, mean activation-rate growth 17.6% over horizon. MRR is held flat at this stage — compounding dynamics haven't started yet.

### Imprint review

> Halfscope Studio is a twelve-person performance marketing agency billing $180k per month, now developing an AI bid-management tool derived from its own agency playbooks. The tool is built but not yet selling — in beta with existing agency clients — which puts the business in a split state where the agency carries current revenue and the tool represents the forward bet. Go-to-market is referral-led, consistent with an agency roster that already trusts the operators enough to run the beta.
>
> The swarm is deployed with 22 of 33 agents active, 10 parked, and 1 disabled. The parked set concentrates in functions that are premature for a pre-launch product with referral-led distribution: cmo.demand and cmo.content, cro.outbound and cro.expansion, cfo.forecast and cfo.treasury, cdo.attribute, coo.dashboard, cpo.qa, and cpo.growth. cfo.econ is disabled outright. The required connector stack is claude-code, github, and slack, with supabase and mixpanel suggested once telemetry becomes load-bearing. Board communications run through Slack as a digest, with urgent items escalating by phone. Claude Code runs on the verified max_20x tier.
>
> The Monte Carlo winner is RETENTION_FIRST — prioritizing depth and stickiness with the existing agency book over new-logo acquisition while the tool is still in beta. The numeric read is flat: Sharpe of 0.00, 0% mean MRR growth across 30 cycles, 0% probability of auto-catalytic growth, 0% probability of ruin, and no cycles-to-critical figure. In plain terms, the model sees a stable, non-compounding path — the agency revenue holds, the tool does not yet inflect, and nothing breaks. The strategy protects the base while the product matures rather than forcing growth the funnel cannot yet support.
>
> A 14-day dry-run window opens 2026-05-06, with 11 tasks held across the swarm. During that window, no agent writes to production systems without operator approval. Before writes go live, the operator needs to review and approve the 11 gated tasks, confirm the three required connectors (claude-code, github, slack) are wired correctly, and decide whether to bring supabase and mixpanel online to support retention measurement. After the dry-run, parked agents can be reactivated as the tool moves from beta into paid distribution.

### Dry-run window
- Dry-run on: **true** · expires **2026-05-06T14:09:06.445Z**
- Manifest hash: `sha256:6625ee4a41920fe7c52f6b5aff2d0f0a7bd91db80ca14cf772eaa8e26b5e2291`

## Run metadata

| Phase | Elapsed (ms) |
|---|---:|
| pillar_1_ms | 2 |
| pillar_2_ms | 0 |
| pillar_3_5_ms | 2 |
| phase_2_ms | 8332 |
| phase_3_ms | 36424 |
| phase_4_ms | 62489 |
| finalize_ms | 14840 |
| **Total T2 calls** | **4** |

