# Variant report · vm09-ecommerce-dtc

*Pipeline mode:* **LIVE T2**
*Fixture description:* Validation matrix F9 · DTC ecommerce, $300k MRR. Expected: Meta+Google ads, no CRM, growth MC acquisition-weighted, cmo.demand spawnable.

## Operator inputs (Pillars 1–5)

- **Company:** Copperthread · `https://copperthread.example`
- **Claude plan:** max_20x
- **Stage:** live_paying_customers · $100k–$1M MRR
- **Lead sources:** inbound_ads_meta_google, content_seo
- **Sales motion:** self_serve_plg
- **Board comms:** slack · digest_plus_urgent_phone

## Phase 1 · Pillar 1 enrichment

- **Enrichment status:** `enriched`
- **Industry hint:** dtc_ecommerce
- **Business model:** one_time_plus_repeat
- **Has product:** yes
- **Ideal customer profile:** consumers
- **Revenue model:** one_time_plus_repeat
- **Competitive position:** emerging
- **Primary acquisition channel:** paid ads
- **Product maturity signal:** ga
- **Tone signal:** playful
- **Primary friction hypothesis:** friction point not clearly specified — infer from GTM stage
- **Differentiator hypothesis:** Direct-to-consumer skincare brand

**Company context:**
> Direct-to-consumer skincare brand. AOV $85, 25% repeat customer rate, $300k MRR. Primary channels: Meta ads, TikTok, email. No sales team — pure e-commerce. 8 SKUs, planning to launch 3 more.

## Phase 2 · Connector manifest

*Source: T2 · onboarding/phase-2*

| Bucket | Count | Connectors |
|---|---:|---|
| Required | 8 | `claude-code`, `supabase`, `github`, `slack`, `meta-ads-api`, `google-ads-api`, `mixpanel`, `shopify` |
| Suggested | 0 | — |
| Deferred | 0 | — |
| Blocked on approval | 1 | `supabase` |

### Required — details

| ID | Priority | Status | Dry-run | Rationale |
|---|---|---|---|---|
| Claude Code (inference) | P-1 | configured | — | Inference bootstrap for Copperthread — verified on max_20x plan during Pillar 2. |
| Supabase (data + auth) | P0 | pending_credential | yes | Copperthread $300k MRR is live — Supabase holds order events + repeat-rate truth feeding cfo/cdo bundles. |
| GitHub (code + ship events) | P1 | pending_credential | — | 8→11 SKU launch cadence — cpo correlates site/PDP ships to activation; cdo joins releases to cohort lift. |
| Slack (Board notifications) | P0 | pending_credential | no | Pillar 5 — Copperthread CEO chose Slack digests with phone escalation for urgent Board pages. |
| Meta Ads (attribution) | P0 | pending_decision | — | Meta is Copperthread's primary paid channel — daily CAC/ROAS attribution required against $85 AOV economics. |
| Google Ads (attribution) | P0 | pending_decision | — | Google completes paid-acquisition picture alongside Meta — both needed for blended CAC vs 25% repeat-rate LTV. |
| Mixpanel (product analytics) | P-1 | pending_decision | — | DTC INBOUND_PLG funnel — Mixpanel joins ad clicks → PDP → checkout → repeat purchase for LTV truth. |
| Shopify (store-of-record) | P0 | pending_decision | — | Copperthread store-of-record — orders, 8 SKU catalog, fulfillment + repeat-customer entities feed every bundle. |

### Blocked on manual approval

- **Supabase (data + auth)** — Supabase service-role key grants read+write across Copperthread MRR tables — operator must approve dry_run before live writes.

## Phase 3 · Swarm manifest

*Source: T2 · onboarding/phase-3*

### Topology
- Total base roster: **33**
- Active: **30**
- Standby: 0
- Parked: 3
- Disabled: 0

### Bundle allocation

| Bundle | Weight |
|---|---:|
| Customer insight & activation | 23% |
| Pipeline & conversion | 11% |
| Retention & expansion | 28% |
| Efficiency & runway | 19% |
| Positioning & narrative | 19% |

### Active agents (30)

| Agent | Department | Level | S+ | Skill overlay |
|---|---|---|:-:|---|
| `ceo.orchestrator` | ceo | L·II |  | — |
| `cdo` | data | L·III |  | — |
| `cdo.attribute` | data | L·IV |  | Copperthread multi-channel attribution across Meta, Google, and organic SEO content into Shopify orders |
| `cdo.infer` | data | L·IV | ✓ | — |
| `cdo.signal` | data | L·IV | ✓ | Copperthread signal sources: Shopify orders, Mixpanel product events, Meta + Google Ads spend/conversion feeds |
| `cdo.telemetry` | data | L·IV |  | — |
| `cfo` | finance | L·III |  | — |
| `cfo.capital` | finance | L·IV |  | — |
| `cfo.econ` | finance | L·IV |  | Copperthread DTC unit economics: watch blended CAC vs 90-day repeat-purchase LTV; paid-ads-dominant mix makes payback period the core constraint |
| `cfo.forecast` | finance | L·IV |  | — |
| `cfo.treasury` | finance | L·IV |  | — |
| `cmo` | marketing | L·III |  | — |
| `cmo.advocacy` | marketing | L·IV |  | — |
| `cmo.brand` | marketing | L·IV |  | — |
| `cmo.content` | marketing | L·IV | ✓ | Copperthread playful-tone content/SEO is a secondary demand lever alongside paid; weight up organic content production to reduce paid-channel dependency |
| `cmo.demand` | marketing | L·IV | ✓ | Copperthread DTC skincare paid acquisition: Meta + Google Ads bid optimization runs hourly; CAC/ROAS is the product at $100k-$1M MRR scale — performance marketing is load-bearing |
| `coo` | ops | L·III |  | — |
| `coo.connector` | ops | L·IV |  | Copperthread connector surface: Shopify, Meta Ads, Google Ads, Mixpanel, Slack, GitHub, Supabase — ads APIs are highest-churn credentials |
| `coo.dashboard` | ops | L·IV |  | Copperthread operator dashboard delivered via Slack digests; playful tone in summaries |
| `coo.health` | ops | L·IV |  | — |
| `coo.memory` | ops | L·IV |  | — |
| `coo.observability` | ops | L·IV |  | — |
| `coo.scheduler` | ops | L·IV |  | — |
| `cpo` | product | L·III |  | — |
| `cpo.build` | product | L·IV | ✓ | — |
| `cpo.growth` | product | L·IV | ✓ | Copperthread DTC skincare at $100k-$1M MRR: prioritize activation loops on first-order → repeat-purchase conversion; Shopify + Mixpanel funnel instrumentation is the primary signal source |
| `cpo.qa` | product | L·IV |  | — |
| `cpo.roadmap` | product | L·IV |  | — |
| `cro` | revenue | L·III |  | — |
| `cro.expansion` | revenue | L·IV | ✓ | Copperthread one-time-plus-repeat revenue model: expansion = repeat-purchase rate, AOV lift, and subscription conversion on Shopify |

### Parked (3) — not needed yet

| Agent | Unpark condition |
|---|---|
| `cro.close` | Sales motion becomes assisted_demo or high_touch_enterprise |
| `cro.demo` | Sales motion becomes assisted_demo or high_touch_enterprise |
| `cro.outbound` | Outbound sales motion adopted (gtm_profile_enum starts with OUTBOUND_) |

### Spawn eligibility (S+)

- **`cpo.build`** — Live paying customers at $100k-$1M MRR — product build queue stays hot for Copperthread
- **`cpo.growth`** — Activation loops on repeat-purchase conversion are the primary PLG lever for Copperthread
- **`cmo.demand`** — Hourly Meta/Google bid optimization on Copperthread DTC paid channel demands sustained spawn capacity
- **`cmo.content`** — Content/SEO is a secondary demand engine — spawn capacity needed to reduce paid dependency
- **`cro.expansion`** — Repeat-purchase and AOV lift are the expansion levers for Copperthread's one-time-plus-repeat model
- **`cdo.signal`** — Multi-source signal ingestion (Shopify, Mixpanel, Meta, Google) justifies sustained spawn capacity
- **`cdo.infer`** — Default S+ eligibility per base roster rules

## Phase 4 · Workflow manifest

*Source: T2 · onboarding/phase-4*

- Agent workflows: 30
- Bundle workflows: 5
- Dry-run gates: **15**
- T2 patches applied: **7**

### T2 patches — per-agent attribution

| Agent | Changed | Pillar signal | Rationale |
|---|---|---|---|
| `cmo.demand` | on_fire | `pillar_2.primary_acquisition=paid_ads + pillar_1.gtm=INBOUND_PLG + pillar_1.icp=consumers` | Copperthread is an INBOUND_PLG DTC skincare brand acquiring consumers via paid ads, not outbound B2B lead sequencing — demand work should optimize paid ad creatives and landing experiences instead of sending outbound messages. |
| `cro.expansion` | on_fire, escalation | `pillar_1.revenue_model=one_time_plus_repeat + pillar_1.icp=consumers` | Revenue model is one_time_plus_repeat for a consumer skincare brand — expansion should drive repeat purchase via Shopify post-purchase flows, not enterprise pipeline engagement actions. |
| `cmo.advocacy` | on_fire | `pillar_1.stage=live_paying_customers + pillar_1.icp=consumers + pillar_1.differentiator=DTC_skincare` | Copperthread is a live_paying_customers DTC skincare brand with consumer ICP — advocacy should harvest UGC/reviews from Shopify order data for paid-ad social proof, not B2B case studies. |
| `cdo.attribute` | on_fire | `pillar_2.primary_acquisition=paid_ads + connectors=meta-ads-api,google-ads-api,shopify,mixpanel` | Paid ads is the primary acquisition channel across Meta + Google with Shopify as the revenue endpoint — attribution must stitch ad_click → Shopify purchase across both ad platforms, not generic telemetry scoring. |
| `cpo.growth` | on_fire | `pillar_1.product_maturity=ga + pillar_2.primary_acquisition=paid_ads + connectors=shopify` | GA-stage consumer skincare on Shopify with paid-ad acquisition — growth work should run PDP/landing conversion experiments and checkout funnel optimizations, not generic artifact drafting. |
| `cmo.content` | on_fire | `pillar_3.tone=playful + pillar_1.differentiator=DTC_skincare + pillar_2.primary_acquisition=paid_ads` | Playful-tone DTC skincare leaning on paid ads — content must produce ad creative variants and UGC-backed social copy, with brand-voice gate explicitly enforcing playful tone before publish. |
| `cfo.econ` | on_fire | `pillar_1.revenue_model=one_time_plus_repeat + pillar_2.primary_acquisition=paid_ads` | One-time-plus-repeat DTC unit economics hinge on CAC-from-paid-ads vs repeat-purchase LTV — the econ loop must compute CAC/LTV payback against Meta+Google+Shopify reality, not generic reallocation. |

### Bundle workflows

| Bundle | Owner | Cycle | KPIs moved |
|---|---|---|---|
| Customer insight & activation | `cpo.growth` | 24h | activation_rate, ttv_hours, nrr |
| Pipeline & conversion | `cro.chief` | 1w | cac, sales_cycle_days, win_rate, mrr |
| Retention & expansion | `cro.expansion` | per-account | nrr, grr, referral_rate, mrr, inbound_quality |
| Efficiency & runway | `cfo.capital` | 1d | burn_multiple, cac_payback_months, cac |
| Positioning & narrative | `cmo.brand` | 1mo | narrative_strength, inbound_quality, sales_cycle_days, win_rate |

### Active-agent workflows (30)

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
| 1 | pull_recent_telemetry | T0 | TLM | — | — |
| 2 | classify_or_score | T1 | — | — | — |
| 3 | synthesize_insight | T2 | — | — | — |
| 4 | emit_tlm_to_chief | T0 | TLM | — | — |

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

**`cpo.growth`** — heartbeat 2h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | read_asn_from_chief | T0 | ASN | — | — |
| 2 | analyze_funnel_dropoff | T0 | TLM | — | mixpanel |
| 3 | design_conversion_experiment | T1 | ASN | — | — |
| 4 | brand_voice_gate | T2 | CON | gated | — |
| 5 | ship_experiment_to_shopify | T2 | VAL | gated | shopify |
| 6 | emit_val_to_chief | T0 | VAL | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `cpo`

**`cmo.demand`** — heartbeat 2h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | pull_paid_ad_performance | T0 | TLM | — | meta-ads-api |
| 2 | identify_fatiguing_creatives | T1 | TLM | — | google-ads-api |
| 3 | draft_creative_refresh_brief | T1 | ASN | — | — |
| 4 | brand_voice_gate | T2 | CON | gated | — |
| 5 | push_budget_reallocation | T2 | VAL | gated | meta-ads-api |
| 6 | emit_val_to_chief | T0 | VAL | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `cmo`
- `lead_count_drops_gt_30pct_wow` → `cmo`

**`cmo.content`** — heartbeat 4h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | read_asn_from_chief | T0 | ASN | — | — |
| 2 | draft_creative_variants | T1 | ASN | — | — |
| 3 | playful_brand_voice_gate | T2 | CON | gated | — |
| 4 | publish_or_ship | T2 | VAL | gated | meta-ads-api |
| 5 | emit_val_to_chief | T0 | VAL | — | — |

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

**`cmo.advocacy`** — heartbeat 6h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | watch_for_delivered_orders | T0 | TLM | — | shopify |
| 2 | score_advocacy_candidates | T1 | TLM | — | mixpanel |
| 3 | draft_review_request | T1 | ASN | — | — |
| 4 | brand_voice_gate | T2 | CON | gated | — |
| 5 | send_review_requests | T2 | VAL | gated | shopify |
| 6 | emit_val_to_cmo_content | T0 | VAL | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `cmo`

**`cro.expansion`** — heartbeat 6h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | pull_recent_orders_and_cohorts | T0 | TLM | — | shopify |
| 2 | score_repurchase_propensity | T1 | TLM | — | mixpanel |
| 3 | draft_replenishment_offer | T1 | ASN | — | — |
| 4 | brand_voice_gate | T2 | CON | gated | — |
| 5 | execute_repeat_purchase_campaign | T2 | VAL | gated | shopify |
| 6 | log_outcome_tlm | T0 | TLM | — | — |

_Escalations:_
- `repurchase_rate_drop>15%_wow` → `cro`
- `at_risk_churn_cohort_size>threshold` → `cmo.advocacy`

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
| 1 | pull_spend_and_revenue | T0 | TLM | — | shopify |
| 2 | compute_cac_ltv_payback | T0 | TLM | — | — |
| 3 | detect_unit_econ_drift | T0 | TLM | — | — |
| 4 | draft_reallocation | T1 | ASN | — | — |
| 5 | narrate_diff_for_board | T2 | TLM | — | — |
| 6 | enforce_new_budgets | T0 | CON | gated | meta-ads-api |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `cfo`
- `burn_multiple_gt_2_5 || runway_lt_12mo` → `ceo.orchestrator`

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
| 1 | pull_ad_click_and_order_events | T0 | TLM | — | mixpanel |
| 2 | stitch_multitouch_attribution | T1 | TLM | — | — |
| 3 | compute_channel_cac_roas | T1 | TLM | — | — |
| 4 | flag_reporting_discrepancies | T2 | TLM | — | — |
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

### Dry-run gates (15)

- `cfo.capital.enforce_new_budgets`
- `cfo.econ.enforce_new_budgets`
- `cmo.advocacy.brand_voice_gate`
- `cmo.advocacy.send_review_requests`
- `cmo.brand.publish_or_ship`
- `cmo.content.playful_brand_voice_gate`
- `cmo.content.publish_or_ship`
- `cmo.demand.brand_voice_gate`
- `cmo.demand.push_budget_reallocation`
- `cpo.build.publish_or_ship`
- `cpo.growth.brand_voice_gate`
- `cpo.growth.ship_experiment_to_shopify`
- `cpo.roadmap.publish_or_ship`
- `cro.expansion.brand_voice_gate`
- `cro.expansion.execute_repeat_purchase_campaign`

## Finalize · strategy review

### Monte Carlo winner
- **Strategy:** Growth-first _(ACQUISITION_HEAVY)_
- _Aggressive top-of-funnel investment, higher variance_
- **Mode:** `growth`
- Projected 30-cycle MRR growth: **13881%** · confidence: high (sharpe 0.54).

**Rationale:**
> ACQUISITION_HEAVY wins: sharpe 0.54 (next BALANCED at 0.53, 2% lead). Mean MRR growth 13880.6%, p(auto-catalytic) 100%, p(ruin) 0%.

### Imprint review

> Copperthread is a direct-to-consumer skincare brand operating at $300k MRR with an $85 average order value and a 25% repeat customer rate. The product is live with paying customers in the $100k–$1M MRR band, sold across 8 SKUs with 3 more in the pipeline. Go-to-market is pure e-commerce with no sales team — an inbound PLG motion running on Meta ads, TikTok, and email, with Shopify as the storefront of record.
>
> The deployed swarm is 30 of 33 agents active, 3 parked, 0 disabled. The parked agents are cro.outbound, cro.demo, and cro.close, which aligns with the absence of a sales team — there is no outbound motion, no demo surface, and no deal close stage for these agents to own in a pure e-commerce funnel. The required connector stack is claude-code, supabase, github, slack, meta-ads-api, google-ads-api, mixpanel, and shopify, with no additional suggested connectors. Board communication runs through Slack on a digest-plus-urgent-phone pattern: routine updates land in Slack, and only urgent matters escalate to phone. Claude Code is on the Max 20x plan, verified.
>
> The Monte Carlo winner is ACQUISITION_HEAVY — a strategy that leans spend and agent effort into the top of the funnel via paid acquisition on Meta and Google, supported by Mixpanel instrumentation. Expected cycles-to-critical is 2.83, meaning the strategy is projected to reach its decisive threshold in under three operating cycles. Sharpe is 0.54, which is a moderate risk-adjusted return — the 30-cycle mean MRR growth of 13,881% comes with meaningful variance rather than a smooth curve. Probability of auto-catalytic behavior is 100% and probability of ruin is 0% across the simulated paths.
>
> The dry-run window is 14 days beginning 2026-05-06T14:11:08.537Z, during which 15 tasks across the swarm are held in dry-run gates. Before writes go live, the operator needs to review and approve those 15 gated tasks — these are the actions the swarm intends to take against Meta Ads, Google Ads, Shopify, and the other write-capable connectors. Nothing mutates external systems until the operator signs off on each gated task or the 14-day window closes with explicit approval.

### Dry-run window
- Dry-run on: **true** · expires **2026-05-06T14:11:08.537Z**
- Manifest hash: `sha256:6013eb65b585513c0d908e61741707913c0f7fb5c6bb00c0acac3a3067d9c34c`

## Run metadata

| Phase | Elapsed (ms) |
|---|---:|
| pillar_1_ms | 1 |
| pillar_2_ms | 0 |
| pillar_3_5_ms | 2 |
| phase_2_ms | 17189 |
| phase_3_ms | 29186 |
| phase_4_ms | 65312 |
| finalize_ms | 18341 |
| **Total T2 calls** | **4** |

