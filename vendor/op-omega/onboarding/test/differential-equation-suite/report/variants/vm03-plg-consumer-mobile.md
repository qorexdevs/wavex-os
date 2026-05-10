# Variant report · vm03-plg-consumer-mobile

*Pipeline mode:* **LIVE T2**
*Fixture description:* Validation matrix F3 · PLG consumer mobile app, $80k MRR, self-serve. Expected: content+activation heavy, no outbound agents.

## Operator inputs (Pillars 1–5)

- **Company:** Streakbloom · `https://streakbloom.example`
- **Claude plan:** max_20x
- **Stage:** live_paying_customers · $10k–$100k MRR
- **Lead sources:** content_seo, referral_word_of_mouth
- **Sales motion:** self_serve_plg
- **Board comms:** slack · digest_plus_urgent_phone

## Phase 1 · Pillar 1 enrichment

- **Enrichment status:** `enriched`
- **Industry hint:** consumer_mobile
- **Business model:** subscription
- **Has product:** yes
- **Ideal customer profile:** consumers
- **Revenue model:** subscription
- **Competitive position:** emerging
- **Primary acquisition channel:** unspecified
- **Product maturity signal:** ga
- **Tone signal:** playful
- **Primary friction hypothesis:** friction point not clearly specified — infer from GTM stage
- **Differentiator hypothesis:** Consumer mobile habit-tracking app with premium subscription at $9.99/mo

**Company context:**
> Consumer mobile habit-tracking app with premium subscription at $9.99/mo. 120k monthly active users, $80k MRR, all self-serve signup. Growth via ASO and Instagram.

## Phase 2 · Connector manifest

*Source: T2 · onboarding/phase-2*

| Bucket | Count | Connectors |
|---|---:|---|
| Required | 5 | `claude-code`, `supabase`, `github`, `slack`, `mixpanel` |
| Suggested | 1 | `segment` |
| Deferred | 0 | — |
| Blocked on approval | 1 | `supabase` |

### Required — details

| ID | Priority | Status | Dry-run | Rationale |
|---|---|---|---|---|
| Claude Code (inference) | P-1 | configured | — | Inference bootstrap for Streakbloom — max_20x plan verified in Pillar 2. |
| Supabase (data + auth) | P0 | pending_credential | yes | Streakbloom $80k MRR lives here — authoritative subscription + event store for cfo and cdo (no Stripe per directive). |
| GitHub (code + ship events) | P1 | pending_credential | — | Mobile ship cadence → activation lift; cpo tracks releases, cdo joins deploys to retention cohorts. |
| Slack (Board notifications) | P0 | pending_credential | no | Pillar 5 — Streakbloom CEO chose Slack digests with phone escalation for urgent items. |
| Mixpanel (product analytics) | P-1 | pending_decision | — | 120k MAU consumer app — activation/retention funnel is the product; session substrate for cpo.growth + cdo.signal. |

### Suggested — details

| ID | Priority | Status | Rationale |
|---|---|---|---|
| Segment (analytics pipe) | P0 | pending_decision | Standardize Streakbloom in-app events upstream of Mixpanel + warehouse + ASO/IG attribution partners. |

### Blocked on manual approval

- **Supabase (data + auth)** — Service-role key grants full read+write on Streakbloom subscription + MRR tables. Operator must approve before dry_run flips to live.

## Phase 3 · Swarm manifest

*Source: T2 · onboarding/phase-3*

### Topology
- Total base roster: **33**
- Active: **28**
- Standby: 0
- Parked: 5
- Disabled: 0

### Bundle allocation

| Bundle | Weight |
|---|---:|
| Customer insight & activation | 22% |
| Pipeline & conversion | 20% |
| Retention & expansion | 18% |
| Efficiency & runway | 18% |
| Positioning & narrative | 22% |

### Active agents (28)

| Agent | Department | Level | S+ | Skill overlay |
|---|---|---|:-:|---|
| `ceo.orchestrator` | ceo | L·II |  | Streakbloom orchestration: consumer mobile habit-tracker at $10-100k MRR — coordinate content-led PLG cycles across CPO/CMO/CDO |
| `cdo` | data | L·III |  | Streakbloom data chief: Mixpanel + Supabase as primary stack, Segment suggested — own activation/retention instrumentation for habit-tracking funnel |
| `cdo.attribute` | data | L·IV |  | Streakbloom attribution: content_seo + word-of-mouth — Segment (suggested) would unlock multi-touch; default to last-touch SEO |
| `cdo.infer` | data | L·IV | ✓ | Streakbloom inference: derive churn-risk and reactivation cohorts from Mixpanel + Supabase — feed CPO.growth experiments |
| `cdo.signal` | data | L·IV | ✓ | Streakbloom signal: Mixpanel as truth source for activation/retention — surface habit-streak completion as leading indicator |
| `cdo.telemetry` | data | L·IV |  | Streakbloom telemetry: mobile-first event capture — instrument habit-loop funnel events end-to-end in Mixpanel |
| `cfo` | finance | L·III |  | Streakbloom finance chief: $10-100k MRR consumer subscription — track LTV/CAC payback by cohort, watch churn at $9.99 price point |
| `cfo.capital` | finance | L·IV |  | Streakbloom capital: $10-100k MRR consumer subscription — model runway against CAC burn before recommending raise |
| `cfo.econ` | finance | L·IV |  | Streakbloom unit economics: $9.99/mo ARPU consumer — track CAC payback by content cohort and LTV at retention curve |
| `cfo.forecast` | finance | L·IV |  | Streakbloom forecast: subscription MRR with content-led acquisition — forecast organic growth + churn, not pipeline |
| `cfo.treasury` | finance | L·IV |  | Streakbloom treasury: subscription cashflow at $10-100k MRR — monitor processor (Stripe-class) reserves and refund rate |
| `cmo` | marketing | L·III |  | Streakbloom marketing chief: content-led PLG with SEO + word-of-mouth as confirmed channels — defer paid until attribution proven |
| `cmo.content` | marketing | L·IV | ✓ | weight_up: Streakbloom's confirmed primary demand driver is content/SEO under CONTENT_LED_PLG — own keyword strategy for habit-tracking intent |
| `cmo.demand` | marketing | L·IV | ✓ | ad_bidding_workflows_disabled: Streakbloom has no ad-platform connector — operate in organic/SEO mode only, surface paid-channel gaps as recommendations |
| `coo` | ops | L·III |  | Streakbloom ops chief: Slack-first comms, GitHub + Claude Code for engineering — keep connector health green across required stack |
| `coo.connector` | ops | L·IV |  | Streakbloom connectors: 5 required + 1 suggested (segment) — prioritize wiring Segment to unlock attribution |
| `coo.dashboard` | ops | L·IV |  | Streakbloom dashboard: surface MRR, activation rate, day-7 retention, content-funnel CAC for the operator |
| `coo.health` | ops | L·IV |  | Streakbloom health: required connectors are claude-code/supabase/github/slack/mixpanel — alert any degradation to Slack |
| `coo.memory` | ops | L·IV |  | Streakbloom memory: persist content-experiment results and habit-cohort findings across cycles |
| `coo.observability` | ops | L·IV |  | Streakbloom observability: GitHub + Supabase + mobile telemetry — bubble incidents into Slack workspace |
| `coo.scheduler` | ops | L·IV |  | Streakbloom scheduler: $10-100k MRR cycle cadence — bias toward CPO.growth and CMO.content slots |
| `cpo` | product | L·III |  | Streakbloom product chief: GA consumer mobile habit-tracker, $9.99/mo subscription — own activation-to-paid funnel |
| `cpo.build` | product | L·IV | ✓ | Streakbloom build agent: GA mobile app on GitHub — ship via Claude Code, prioritize habit-loop polish over net-new surface area |
| `cpo.growth` | product | L·IV | ✓ | weight_up: Streakbloom activation loops are the primary lever — habit-streak onboarding and day-1/day-7 retention beat acquisition spend |
| `cpo.qa` | product | L·IV |  | Streakbloom QA: live paying users on $9.99/mo — regression risk is churn-inducing, gate releases on habit-streak integrity |
| `cpo.roadmap` | product | L·IV |  | Streakbloom roadmap: $10-100k MRR stage — sequence around activation lift and retention, defer enterprise/team features |
| `cro` | revenue | L·III |  | Streakbloom revenue chief: self-serve PLG only, no sales motion — focus on subscription expansion (annual upsell, plan tier-up) |
| `cro.expansion` | revenue | L·IV | ✓ | Streakbloom expansion: only revenue lever in self-serve PLG — drive monthly→annual conversion and price-tier upgrades on $9.99 base |

### Parked (5) — not needed yet

| Agent | Unpark condition |
|---|---|
| `cmo.advocacy` | Stage reaches 100k_1m_mrr or referral motion adopted |
| `cmo.brand` | Stage reaches 100k_1m_mrr (positioning becomes load-bearing) |
| `cro.close` | Sales motion becomes assisted_demo or high_touch_enterprise |
| `cro.demo` | Sales motion becomes assisted_demo or high_touch_enterprise |
| `cro.outbound` | Outbound sales motion adopted (gtm_profile_enum starts with OUTBOUND_) |

### Spawn eligibility (S+)

- **`cpo.growth`** — Streakbloom activation loops are the dominant lever at $10-100k MRR — expect heavy experiment queue in first 30 cycles
- **`cmo.content`** — Confirmed primary acquisition channel under CONTENT_LED_PLG — keyword + asset production queue justifies parallelism
- **`cdo.signal`** — Mixpanel instrumentation backlog for habit-loop funnel will fan out — multiple signal definitions to land early
- **`cdo.infer`** — Churn-risk and cohort inference jobs feed CPO.growth experiments — parallel inference passes warranted
- **`cro.expansion`** — Only active revenue lever in self-serve PLG — monthly→annual and tier-upgrade experiments will queue

## Phase 4 · Workflow manifest

*Source: T2 · onboarding/phase-4*

- Agent workflows: 28
- Bundle workflows: 5
- Dry-run gates: **8**
- T2 patches applied: **7**

### T2 patches — per-agent attribution

| Agent | Changed | Pillar signal | Rationale |
|---|---|---|---|
| `cmo.content` | on_fire | `pillar_2.gtm_profile=CONTENT_LED_PLG` | Streakbloom is CONTENT_LED_PLG targeting consumers with a playful tone, so content must be tuned for consumer habit-tracking hooks and shipped through social/app-store surfaces rather than generic artifact drafting. |
| `cpo.growth` | on_fire | `pillar_3.product_maturity=ga+icp=consumers` | For a GA consumer mobile habit-tracker on subscription, cpo.growth should run activation/retention experiments on streak mechanics rather than draft generic artifacts. |
| `cmo.demand` | on_fire, escalation | `pillar_2.icp=consumers+revenue_model=subscription` | Streakbloom has no traditional lead pipeline — as a consumer mobile PLG subscription app, cmo.demand should drive top-of-funnel installs via content distribution rather than score and message B2B leads. |
| `cro.expansion` | on_fire, escalation | `pillar_2.revenue_model=subscription+icp=consumers` | Consumer $9.99/mo subscription has no sales-led expansion motion, so cro.expansion should focus on trial-to-paid conversion, win-back, and churn rescue rather than account engagement briefs. |
| `cdo.attribute` | on_fire | `pillar_2.primary_acquisition=unspecified+gtm=CONTENT_LED_PLG` | In CONTENT_LED_PLG with unspecified acquisition, attribution must identify which content surfaces actually drive paid subscribers so CMO/CPO can double down — generic telemetry scoring is insufficient. |
| `cdo.signal` | on_fire | `pillar_3.product=consumer_habit_tracking_app_with_premium_subscription` | As a live-paying GA consumer app, cdo.signal's highest-leverage signal is streak-behavior + subscription health, so telemetry pulls should be explicitly scoped to those events rather than generic classification. |
| `cpo.qa` | on_fire, escalation | `pillar_3.product_maturity=ga+consumer_mobile` | Streakbloom is a GA consumer mobile app where app-store ratings and crash-free streaks directly gate growth, so QA should pull store/crash telemetry and escalate on rating drops rather than run generic scoring. |

### Bundle workflows

| Bundle | Owner | Cycle | KPIs moved |
|---|---|---|---|
| Customer insight & activation | `cpo.growth` | 24h | activation_rate, ttv_hours, nrr |
| Pipeline & conversion | `cro.chief` | 1w | cac, sales_cycle_days, win_rate, mrr |
| Retention & expansion | `cro.expansion` | per-account | nrr, grr, referral_rate, mrr, inbound_quality |
| Efficiency & runway | `cfo.capital` | 1d | burn_multiple, cac_payback_months, cac |
| Positioning & narrative | `cmo.brand` | 1mo | narrative_strength, inbound_quality, sales_cycle_days, win_rate |

### Active-agent workflows (28)

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
| 1 | pull_store_reviews_and_crashes | T0 | TLM | — | mixpanel |
| 2 | classify_user_complaints | T1 | TLM | — | — |
| 3 | synthesize_quality_risk | T2 | TLM | — | — |
| 4 | emit_tlm_to_chief | T0 | TLM | — | — |

_Escalations:_
- `app_store_rating_drop_gt_0_2` → `cpo`
- `streak_loss_bug_reports_spike` → `cpo`
- `crash_free_rate_below_99_5pct` → `cpo`

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
| 2 | pull_funnel_telemetry | T0 | TLM | — | mixpanel |
| 3 | design_streak_experiment | T1 | ASN | — | — |
| 4 | stage_experiment_config | T2 | VAL | gated | github |
| 5 | measure_lift_on_trial_to_paid | T1 | TLM | — | mixpanel |
| 6 | emit_val_to_chief | T0 | VAL | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `cpo`

**`cmo.demand`** — heartbeat 2h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | pull_install_and_content_signals | T0 | TLM | — | mixpanel |
| 2 | identify_breakout_content | T0 | TLM | — | segment |
| 3 | draft_amplification_plan | T1 | ASN | — | — |
| 4 | quality_gate_claims | T2 | CON | — | — |
| 5 | stage_distribution | T2 | VAL | gated | slack |
| 6 | emit_val_to_chief | T0 | VAL | — | — |

_Escalations:_
- `CAC_payback_over_12mo` → `cmo`
- `install_conversion_drop_gt_20pct` → `cmo`

**`cmo.content`** — heartbeat 4h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | read_asn_from_chief | T0 | ASN | — | — |
| 2 | pull_engagement_signals | T0 | TLM | — | mixpanel |
| 3 | draft_playful_consumer_artifact | T1 | ASN | — | — |
| 4 | brand_voice_gate | T2 | CON | — | — |
| 5 | publish_or_ship | T2 | VAL | gated | github |
| 6 | emit_val_to_chief | T0 | VAL | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `cmo`

**`cro.expansion`** — heartbeat 6h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | read_subscription_cohorts | T0 | TLM | — | supabase |
| 2 | score_churn_and_winback_candidates | T0 | TLM | — | mixpanel |
| 3 | draft_playful_lifecycle_message | T1 | ASN | — | — |
| 4 | stage_lifecycle_send | T2 | VAL | gated | segment |
| 5 | log_outcome_tlm | T0 | TLM | — | mixpanel |

_Escalations:_
- `churn_spike_gt_15pct_wow` → `cro`
- `trial_to_paid_drop_gt_10pct` → `cro`

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

**`cfo.forecast`** — heartbeat 4h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | pull_recent_telemetry | T0 | TLM | — | — |
| 2 | classify_or_score | T1 | — | — | — |
| 3 | synthesize_insight | T2 | — | — | — |
| 4 | emit_tlm_to_chief | T0 | TLM | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `cfo`

**`cfo.treasury`** — heartbeat 1d

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | pull_recent_telemetry | T0 | TLM | — | — |
| 2 | classify_or_score | T1 | — | — | — |
| 3 | synthesize_insight | T2 | — | — | — |
| 4 | emit_tlm_to_chief | T0 | TLM | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `cfo`

**`cfo.econ`** — heartbeat 1d

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
| 1 | pull_streak_and_subscription_events | T0 | TLM | — | mixpanel |
| 2 | detect_anomalies_in_streak_behavior | T1 | TLM | — | — |
| 3 | synthesize_habit_health_insight | T2 | TLM | — | — |
| 4 | emit_tlm_to_chief | T0 | TLM | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `cdo`

**`cdo.attribute`** — heartbeat 4h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | pull_multi_touch_install_paths | T0 | TLM | — | segment |
| 2 | pull_content_engagement | T0 | TLM | — | mixpanel |
| 3 | score_content_to_paid_contribution | T1 | TLM | — | — |
| 4 | synthesize_primary_acquisition_hypothesis | T2 | TLM | — | — |
| 5 | emit_tlm_to_chief | T0 | TLM | — | — |

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

**`coo.dashboard`** — heartbeat 1h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | run_check | T0 | — | — | — |
| 2 | summarize_if_anomaly | T1 | — | — | — |
| 3 | emit_tlm_to_coo | T0 | TLM | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `coo`

### Dry-run gates (8)

- `cfo.capital.enforce_new_budgets`
- `cfo.econ.enforce_new_budgets`
- `cmo.content.publish_or_ship`
- `cmo.demand.stage_distribution`
- `cpo.build.publish_or_ship`
- `cpo.growth.stage_experiment_config`
- `cpo.roadmap.publish_or_ship`
- `cro.expansion.stage_lifecycle_send`

## Finalize · strategy review

### Monte Carlo winner
- **Strategy:** Runway-first _(CAPITAL_EFFICIENT)_
- _Preserve capital while validating product-market fit_
- **Mode:** `growth`
- Projected 30-cycle MRR growth: **1105%** · confidence: moderate (sharpe 0.36).

**Rationale:**
> CAPITAL_EFFICIENT wins: sharpe 0.36 (next RETENTION_FIRST at 0.21, 71% lead). Mean MRR growth 1105.0%, p(auto-catalytic) 97%, p(ruin) 0%.

### Imprint review

> Streakbloom is a consumer mobile habit-tracking app running a content-led PLG motion. The product is live with paying customers, sitting in the $10k–$100k MRR band at $80k MRR against 120k monthly active users, all on self-serve signup into a $9.99/mo premium subscription. Growth comes through ASO and Instagram, with no sales-assisted path in the funnel.
>
> The deployed swarm is 28 of 33 agents active, 5 parked, none disabled. The parked roster is consistent with the motion: cmo.brand and cmo.advocacy are held back while the content-led acquisition stack carries top-of-funnel, and the entire outbound-to-close CRO line — cro.outbound, cro.demo, cro.close — stays parked because the revenue model is self-serve and there is no pipeline for those agents to act on. The required connector stack is claude-code, supabase, github, slack, and mixpanel, with segment suggested as a follow-on. Board comms run through Slack as a regular digest, with phone escalation reserved for urgent items. Claude Code is on the verified max_20x tier.
>
> The Monte Carlo winner is CAPITAL_EFFICIENT. Across 30 cycles the strategy projects 1105% mean MRR growth with a 97% probability of going auto-catalytic and a 0% probability of ruin, reaching critical at roughly 16.5 cycles. The Sharpe of 0.36 is modest, which reads as a path that is directionally strong and survivable rather than a tight, high-conviction return profile — the upside is real but the cycle-to-cycle variance is wide enough that the operator should expect uneven progress between now and the critical threshold.
>
> Dry-run runs 14 days from 2026-05-06, during which 8 tasks across the swarm are held dry and will not write to live systems until the operator approves them. Before the window closes, the operator needs to walk those 8 gated tasks, confirm the intended writes against Supabase, GitHub, Mixpanel, and Slack, and clear each one for live execution. Anything still pending approval at the end of the window will block the swarm from moving the CAPITAL_EFFICIENT plan out of simulation and into production cycles.

### Dry-run window
- Dry-run on: **true** · expires **2026-05-06T13:57:43.933Z**
- Manifest hash: `sha256:ad4166ec3105cc29be6d12824f7ed58629bb586f8c7cf508fb0fc480db00318f`

## Run metadata

| Phase | Elapsed (ms) |
|---|---:|
| pillar_1_ms | 1 |
| pillar_2_ms | 0 |
| pillar_3_5_ms | 2 |
| phase_2_ms | 15658 |
| phase_3_ms | 42164 |
| phase_4_ms | 55300 |
| finalize_ms | 14867 |
| **Total T2 calls** | **4** |

