# Variant report · vm10-hardware-kickstarter-hybrid

*Pipeline mode:* **LIVE T2**
*Fixture description:* Validation matrix F10 · Hardware+software hybrid post-Kickstarter. Expected: activation+retention emphasis, low-MRR but post-product.

## Operator inputs (Pillars 1–5)

- **Company:** Blumebench · `https://blumebench.example`
- **Claude plan:** max_20x
- **Stage:** live_paying_customers · < $10k MRR
- **Lead sources:** content_seo, referral_word_of_mouth
- **Sales motion:** self_serve_plg
- **Board comms:** slack · digest_plus_urgent_phone

## Phase 1 · Pillar 1 enrichment

- **Enrichment status:** `enriched`
- **Industry hint:** consumer_hardware
- **Business model:** one_time_plus_repeat
- **Has product:** yes
- **Ideal customer profile:** unspecified
- **Revenue model:** subscription
- **Competitive position:** emerging
- **Primary acquisition channel:** unspecified
- **Product maturity signal:** ga
- **Tone signal:** friendly
- **Primary friction hypothesis:** friction point not clearly specified — infer from GTM stage
- **Differentiator hypothesis:** Smart-home sensor with companion iOS/Android app

**Company context:**
> Smart-home sensor with companion iOS/Android app. $199 hardware + $5/mo optional cloud storage. Post-Kickstarter, 4,200 hardware units sold, 1,100 on monthly sub = $5.5k MRR. Hardware revenue separate.

## Phase 2 · Connector manifest

*Source: T2 · onboarding/phase-2*

| Bucket | Count | Connectors |
|---|---:|---|
| Required | 4 | `claude-code`, `supabase`, `github`, `slack` |
| Suggested | 1 | `mixpanel` |
| Deferred | 0 | — |
| Blocked on approval | 1 | `supabase` |

### Required — details

| ID | Priority | Status | Dry-run | Rationale |
|---|---|---|---|---|
| Claude Code (inference) | P-1 | configured | — | Inference bootstrap for Blumebench's Omega instance — verified on max_20x plan during Pillar 2. |
| Supabase (data + auth) | P0 | pending_credential | yes | Authoritative source for Blumebench's $5.5k MRR, 1,100 sub cohort, and sensor telemetry events feeding cfo + cdo. |
| GitHub (code + ship events) | P1 | pending_credential | — | Correlate firmware/app ship events with sub activation — cpo tracks merges, cdo joins to GA hardware cohorts. |
| Slack (Board notifications) | P0 | pending_credential | no | Pillar 5 channel for CEO→Omega notifications; digest + urgent phone routing layered on top. |

### Suggested — details

| ID | Priority | Status | Rationale |
|---|---|---|---|
| Mixpanel (product analytics) | P1 | pending_decision | CONTENT_LED_PLG with referral loop — measure app activation + champion identification for cro.expansion / cmo.advocacy. |

### Blocked on manual approval

- **Supabase (data + auth)** — Supabase service-role key grants read+write on all tables. Operator must review + approve dry_run before any writes go live.

## Phase 3 · Swarm manifest

*Source: T0 · decision-matrix-fallback*

### Topology
- Total base roster: **33**
- Active: **24**
- Standby: 0
- Parked: 9
- Disabled: 0

### Bundle allocation

| Bundle | Weight |
|---|---:|
| Customer insight & activation | 27% |
| Pipeline & conversion | 27% |
| Retention & expansion | 9% |
| Efficiency & runway | 14% |
| Positioning & narrative | 23% |

### Active agents (24)

| Agent | Department | Level | S+ | Skill overlay |
|---|---|---|:-:|---|
| `ceo.orchestrator` | ceo | L·II |  | — |
| `cdo` | data | L·III |  | — |
| `cdo.attribute` | data | L·IV |  | — |
| `cdo.infer` | data | L·IV | ✓ | — |
| `cdo.signal` | data | L·IV | ✓ | — |
| `cdo.telemetry` | data | L·IV |  | — |
| `cfo` | finance | L·III |  | — |
| `cfo.capital` | finance | L·IV |  | — |
| `cfo.treasury` | finance | L·IV |  | — |
| `cmo` | marketing | L·III |  | — |
| `cmo.content` | marketing | L·IV | ✓ | weight_up: primary demand driver under content/PLG |
| `cmo.demand` | marketing | L·IV | ✓ | ad_bidding_workflows_disabled: no ad-platform connector in manifest |
| `coo` | ops | L·III |  | — |
| `coo.connector` | ops | L·IV |  | — |
| `coo.health` | ops | L·IV |  | — |
| `coo.memory` | ops | L·IV |  | — |
| `coo.observability` | ops | L·IV |  | — |
| `coo.scheduler` | ops | L·IV |  | — |
| `cpo` | product | L·III |  | — |
| `cpo.build` | product | L·IV | ✓ | — |
| `cpo.growth` | product | L·IV | ✓ | weight_up: activation loops matter most |
| `cpo.qa` | product | L·IV |  | — |
| `cpo.roadmap` | product | L·IV |  | — |
| `cro` | revenue | L·III |  | — |

### Parked (9) — not needed yet

| Agent | Unpark condition |
|---|---|
| `cfo.econ` | Stage reaches 10k_100k_mrr (unit economics become the primary lens) |
| `cfo.forecast` | Stage reaches 10k_100k_mrr (forecast becomes actionable) |
| `cmo.advocacy` | Stage reaches 100k_1m_mrr or referral motion adopted |
| `cmo.brand` | Stage reaches 100k_1m_mrr (positioning becomes load-bearing) |
| `coo.dashboard` | Stage reaches 10k_100k_mrr (dashboard becomes load-bearing for Board communication) |
| `cro.close` | Sales motion becomes assisted_demo or high_touch_enterprise |
| `cro.demo` | Sales motion becomes assisted_demo or high_touch_enterprise |
| `cro.expansion` | Stage reaches 10k_100k_mrr (enough accounts to expand) |
| `cro.outbound` | Outbound sales motion adopted (gtm_profile_enum starts with OUTBOUND_) |

### Spawn eligibility (S+)

- **`cpo.build`** — Default S+ eligibility per base roster rules
- **`cpo.growth`** — weight_up: activation loops matter most
- **`cmo.demand`** — ad_bidding_workflows_disabled: no ad-platform connector in manifest
- **`cmo.content`** — weight_up: primary demand driver under content/PLG
- **`cdo.signal`** — Default S+ eligibility per base roster rules
- **`cdo.infer`** — Default S+ eligibility per base roster rules

## Phase 4 · Workflow manifest

*Source: T2 · onboarding/phase-4*

- Agent workflows: 24
- Bundle workflows: 5
- Dry-run gates: **8**
- T2 patches applied: **8**

### T2 patches — per-agent attribution

| Agent | Changed | Pillar signal | Rationale |
|---|---|---|---|
| `cmo.content` | on_fire | `pillar_2.gtm_profile=CONTENT_LED_PLG` | Blumebench is a CONTENT_LED_PLG operator at the live_paying_customers stage, so cmo.content is the primary acquisition engine and needs an SEO-driven research-to-publish pipeline rather than a generic draft/ship loop. |
| `cpo.growth` | on_fire, escalation | `pillar_3.revenue_model=subscription` | Blumebench is a GA subscription product on CONTENT_LED_PLG, so cpo.growth should focus on activation/onboarding experiments inside the companion iOS/Android app rather than generic 'draft artifact' work. |
| `cmo.demand` | on_fire, escalation | `pillar_2.primary_acquisition=unspecified` | Primary acquisition is unspecified for a CONTENT_LED_PLG smart-home product, so cmo.demand should treat inbound content/app-store leads as the source rather than running outbound sequences that don't fit a B2C sensor product. |
| `cdo.attribute` | on_fire | `pillar_2.gtm_profile=CONTENT_LED_PLG` | For a CONTENT_LED_PLG operator, attribution must tie content URLs to subscription conversions through the companion-app funnel — the generic telemetry loop doesn't capture that join. |
| `cpo.qa` | on_fire, escalation | `pillar_4.product=Smart-home sensor with companion iOS/Android app` | Blumebench ships a smart-home sensor with iOS/Android app at GA, so cpo.qa must monitor crashes and sensor-pairing failures across mobile platforms rather than running a generic telemetry classifier. |
| `cfo.capital` | on_fire | `pillar_1.stage=live_paying_customers` | As a live_paying_customers subscription operator, cfo.capital should reallocate budget against per-agent CAC↔LTV impact, not just generic ROI — and any budget enforcement must be gated. |
| `coo.health` | on_fire, escalation | `pillar_4.product_maturity=ga` | Blumebench's product is a hardware sensor + mobile app at GA, so coo.health must watch sensor ingest pipelines and app backends — a 15m generic check loop should be specialized to those failure modes. |
| `ceo.orchestrator` | on_fire | `pillar_1.stage=live_paying_customers` | At live_paying_customers with a CONTENT_LED_PLG motion, the orchestrator should explicitly weight the content→activation→subscription flywheel when allocating attention, not run a generic flywheel loop. |

### Bundle workflows

| Bundle | Owner | Cycle | KPIs moved |
|---|---|---|---|
| Customer insight & activation | `cpo.growth` | 24h | activation_rate, ttv_hours, nrr |
| Pipeline & conversion | `cro.chief` | 1w | cac, sales_cycle_days, win_rate, mrr |
| Retention & expansion | `cro.expansion` | per-account | nrr, grr, referral_rate, mrr, inbound_quality |
| Efficiency & runway | `cfo.capital` | 1d | burn_multiple, cac_payback_months, cac |
| Positioning & narrative | `cmo.brand` | 1mo | narrative_strength, inbound_quality, sales_cycle_days, win_rate |

### Active-agent workflows (24)

**`ceo.orchestrator`** — heartbeat 15m

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | read_kpi_state_vector | T0 | TLM | — | supabase |
| 2 | compute_content_plg_flywheel_score | T0 | — | — | — |
| 3 | allocate_bundle_attention | T2 | — | — | — |
| 4 | oscillate_explore | T0 | — | — | — |
| 5 | emit_bundle_asn_to_csuite | T2 | ASN | gated | — |
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
| 2 | draft_artifact | T1 | — | — | — |
| 3 | brand_voice_gate | T2 | — | — | — |
| 4 | publish_or_ship | T2 | VAL | gated | github |
| 5 | emit_val_to_chief | T0 | VAL | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `cpo`

**`cpo.qa`** — heartbeat 4h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | pull_mobile_crash_and_pairing_telemetry | T0 | TLM | — | mixpanel |
| 2 | classify_regression_severity | T1 | — | — | — |
| 3 | open_bug_tickets | T2 | VAL | gated | github |
| 4 | emit_tlm_to_chief | T0 | TLM | — | — |

_Escalations:_
- `sensor_pairing_failure_rate_gt_5pct` → `cpo`
- `crash_free_users_lt_99pct` → `ceo.orchestrator`

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

**`cpo.growth`** — heartbeat 2h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | read_asn_from_chief | T0 | ASN | — | — |
| 2 | pull_app_activation_funnel | T0 | TLM | — | mixpanel |
| 3 | design_plg_experiment | T1 | — | — | — |
| 4 | open_experiment_pr | T2 | VAL | gated | github |
| 5 | emit_val_to_chief | T0 | VAL | — | — |

_Escalations:_
- `day7_retention_drop_gt_5pct_wow` → `cpo`
- `experiment_blocks_paid_conversion` → `cro`

**`cmo.demand`** — heartbeat 2h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | pull_inbound_signups | T0 | TLM | — | supabase |
| 2 | score_intent_by_app_activity | T0 | — | — | mixpanel |
| 3 | draft_lifecycle_nudges | T1 | — | — | — |
| 4 | quality_gate_before_send | T2 | — | — | — |
| 5 | send_lifecycle_messages | T0 | VAL | gated | slack |
| 6 | emit_val_to_chief | T0 | VAL | — | — |

_Escalations:_
- `signup_to_paired_sensor_lt_30pct` → `cmo`
- `opt_out_rate_gt_2pct` → `ceo.orchestrator`

**`cmo.content`** — heartbeat 4h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | read_asn_from_chief | T0 | ASN | — | — |
| 2 | mine_organic_search_gaps | T1 | TLM | — | mixpanel |
| 3 | draft_long_form_with_companion_app_demo | T1 | — | — | — |
| 4 | brand_voice_gate_friendly | T2 | — | — | — |
| 5 | publish_and_distribute | T2 | VAL | gated | github |
| 6 | emit_val_to_chief | T0 | VAL | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `cmo`

**`cfo.capital`** — heartbeat 1h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | compute_marginal_cac_ltv_per_agent | T0 | TLM | — | supabase |
| 2 | detect_drift_vs_target_payback | T0 | — | — | — |
| 3 | draft_reallocation | T1 | — | — | — |
| 4 | narrate_diff_for_board | T2 | TLM | — | — |
| 5 | enforce_new_budgets | T0 | CON | gated | supabase |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `cfo`
- `burn_multiple_gt_2_5 || runway_lt_12mo` → `ceo.orchestrator`

**`cfo.treasury`** — heartbeat 1d

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | pull_recent_telemetry | T0 | TLM | — | — |
| 2 | classify_or_score | T1 | — | — | — |
| 3 | synthesize_insight | T2 | — | — | — |
| 4 | emit_tlm_to_chief | T0 | TLM | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `cfo`

**`cdo.signal`** — heartbeat 1h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | pull_recent_telemetry | T0 | TLM | — | — |
| 2 | classify_or_score | T1 | — | — | — |
| 3 | synthesize_insight | T2 | — | — | — |
| 4 | emit_tlm_to_chief | T0 | TLM | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `cdo`

**`cdo.attribute`** — heartbeat 4h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | pull_content_to_signup_events | T0 | TLM | — | mixpanel |
| 2 | attribute_subscriptions_to_content | T1 | — | — | — |
| 3 | flag_low_yield_clusters | T2 | — | — | — |
| 4 | emit_tlm_to_chief | T0 | TLM | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `cdo`

**`cdo.telemetry`** — heartbeat 2h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | pull_recent_telemetry | T0 | TLM | — | — |
| 2 | classify_or_score | T1 | — | — | — |
| 3 | synthesize_insight | T2 | — | — | — |
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
| 1 | check_sensor_ingest_pipeline | T0 | — | — | supabase |
| 2 | check_mobile_api_latency | T0 | — | — | — |
| 3 | summarize_if_anomaly | T1 | — | — | — |
| 4 | emit_tlm_to_coo | T0 | TLM | — | — |

_Escalations:_
- `ingest_lag_gt_5min` → `coo`
- `mobile_api_p95_gt_1s` → `coo`

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

### Dry-run gates (8)

- `ceo.orchestrator.emit_bundle_asn_to_csuite`
- `cfo.capital.enforce_new_budgets`
- `cmo.content.publish_and_distribute`
- `cmo.demand.send_lifecycle_messages`
- `cpo.build.publish_or_ship`
- `cpo.growth.open_experiment_pr`
- `cpo.qa.open_bug_tickets`
- `cpo.roadmap.publish_or_ship`

## Finalize · strategy review

### Monte Carlo winner
- **Strategy:** Retention-led _(RETENTION_FIRST)_
- _Expand and protect existing customers before growing top of funnel_
- **Mode:** `pre_scale`
- At pre-scale operators the simulator holds MRR flat — the number that matters is capital preservation. Runway is **high** (p(ruin) 0%).

**Rationale:**
> RETENTION_FIRST wins on capital preservation: p(ruin) 0%, mean activation-rate growth 45.7% over horizon. MRR is held flat at this stage — compounding dynamics haven't started yet.

### Imprint review

> Blumebench is a smart-home sensor company shipping $199 hardware with an optional $5/month cloud storage add-on through iOS and Android companion apps. Post-Kickstarter, the operator has moved 4,200 hardware units and converted 1,100 of those buyers to monthly subscriptions, producing $5.5k MRR alongside separate hardware revenue. The product is live with paying customers but still sits under the $10k MRR threshold, and the go-to-market motion is content-led PLG rather than sales-driven.
>
> The swarm deploys 24 of 33 agents, with 9 parked and none disabled. The parked set concentrates in outbound and bottom-funnel CRO work — cro.outbound, cro.demo, cro.close, cro.expansion — along with cmo.brand and cmo.advocacy on the marketing side, cfo.forecast and cfo.econ on finance, and coo.dashboard on operations, reflecting a stage where outbound sales motion and heavy forecasting are premature for a sub-$10k MRR PLG company. Required connectors are claude-code, supabase, github, and slack, with mixpanel suggested for product analytics. Board communication runs through Slack as a digest plus urgent phone escalation, and Claude Code is verified on the max_20x tier.
>
> The Monte Carlo winner is RETENTION_FIRST, prioritizing work on the existing 1,100-subscriber base and the conversion path from the 3,100 hardware-only buyers over net-new acquisition. The 30-cycle simulation returned a Sharpe of 0.00, mean MRR growth of 0%, auto-catalytic probability of 0%, and ruin probability of 0%, with cycles-to-critical undefined. The read is that retention-first is the least risky posture available but is not modeled to compound on its own — the strategy holds the floor rather than driving breakout growth, and upside will require a second motion layered on top once retention work stabilizes.
>
> The dry-run window runs 14 days from 2026-05-06, during which 8 tasks across the swarm are held as dry-run gates. Before writes go live, the operator needs to review and approve those 8 gated tasks, confirm the four required connectors are authenticated, and decide whether to wire up the suggested mixpanel connector. Any agent currently parked stays parked through the dry-run unless explicitly activated.

### Dry-run window
- Dry-run on: **true** · expires **2026-05-06T14:13:18.573Z**
- Manifest hash: `sha256:c7d0e8734c85359cea9957b3a32f26223fb69711faf3ace3461b633a31add621`

## Run metadata

| Phase | Elapsed (ms) |
|---|---:|
| pillar_1_ms | 1 |
| pillar_2_ms | 1 |
| pillar_3_5_ms | 2 |
| phase_2_ms | 14555 |
| phase_3_ms | 32548 |
| phase_4_ms | 68254 |
| finalize_ms | 16404 |
| **Total T2 calls** | **3** |

