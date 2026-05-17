# Variant report · vm04-scale-enterprise-b2b

*Pipeline mode:* **LIVE T2**
*Fixture description:* Validation matrix F4 · Scale enterprise B2B, $1.5M ARR. Expected: large swarm (22-28), expansion+advocacy active, scale MC.

## Operator inputs (Pillars 1–5)

- **Company:** Rhinegate · `https://rhinegate.example`
- **Claude plan:** max_20x
- **Stage:** live_paying_customers · $100k–$1M MRR
- **Lead sources:** referral_word_of_mouth, outbound_cold
- **Sales motion:** high_touch_enterprise
- **Board comms:** slack · digest_plus_urgent_phone

## Phase 1 · Pillar 1 enrichment

- **Enrichment status:** `enriched`
- **Industry hint:** enterprise_saas
- **Business model:** subscription
- **Has product:** yes
- **Ideal customer profile:** enterprise ops teams
- **Revenue model:** subscription
- **Competitive position:** emerging
- **Primary acquisition channel:** unspecified
- **Product maturity signal:** ga
- **Tone signal:** enterprise
- **Primary friction hypothesis:** friction point not clearly specified — infer from GTM stage
- **Differentiator hypothesis:** Enterprise data governance platform

**Company context:**
> Enterprise data governance platform. Sells to Fortune 1000 CISOs. Average contract $80k/year, 18 customers, $1.5M ARR. Sales cycle 6-9 months via RFPs and executive relationships. Champions drive 80% of pipeline.

## Phase 2 · Connector manifest

*Source: T2 · onboarding/phase-2*

| Bucket | Count | Connectors |
|---|---:|---|
| Required | 4 | `claude-code`, `supabase`, `github`, `slack` |
| Suggested | 2 | `mixpanel`, `hubspot` |
| Deferred | 0 | — |
| Blocked on approval | 1 | `supabase` |

### Required — details

| ID | Priority | Status | Dry-run | Rationale |
|---|---|---|---|---|
| Claude Code (inference) | P-1 | configured | — | Inference bootstrap for Rhinegate — max_20x plan verified in Pillar 2. |
| Supabase (data + auth) | P0 | pending_credential | yes | Rhinegate's $1.5M ARR across 18 enterprise accounts — authoritative MRR/NRR + product events for cfo/cdo. |
| GitHub (code + ship events) | P1 | pending_credential | — | GA product at 100k–1M MRR — cpo tracks ship velocity, cdo joins deploys to enterprise activation cohorts. |
| Slack (Board notifications) | P0 | pending_credential | no | Pillar 5 routing — Slack digest + urgent phone chosen by Rhinegate operator for CEO notifications. |

### Suggested — details

| ID | Priority | Status | Rationale |
|---|---|---|---|
| Mixpanel (product analytics) | P1 | pending_decision | Secondary telemetry for cdo anomaly detection on Fortune 1000 champion engagement beyond Supabase events. |
| HubSpot (CRM) | P0 | pending_decision | REFERRAL_LED + high-touch enterprise, 6–9mo RFP cycles — CRM substrate for cro.demo/close/expansion pipeline state. |

### Blocked on manual approval

- **Supabase (data + auth)** — Supabase service-role key grants read+write on all tables. Operator must review + approve dry_run before any writes go live.

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
| Customer insight & activation | 9% |
| Pipeline & conversion | 11% |
| Retention & expansion | 40% |
| Efficiency & runway | 22% |
| Positioning & narrative | 18% |

### Active agents (30)

| Agent | Department | Level | S+ | Skill overlay |
|---|---|---|:-:|---|
| `ceo.orchestrator` | ceo | L·II |  | Orchestrate Rhinegate swarm: enterprise SaaS at $100k-$1M MRR, referral-led GTM, high-touch enterprise sales |
| `cdo` | data | L·III |  | Own data intelligence across Rhinegate's governance platform and internal Supabase/Mixpanel telemetry |
| `cdo.attribute` | data | L·IV |  | Attribute Rhinegate revenue to referral sources and enterprise ops ICP segments |
| `cdo.infer` | data | L·IV | ✓ | Infer expansion and churn risk signals from Rhinegate customer behavior across enterprise accounts |
| `cdo.signal` | data | L·IV | ✓ | Extract product and customer signal from Rhinegate's supabase/mixpanel/hubspot stack |
| `cdo.telemetry` | data | L·IV |  | Instrument Rhinegate governance platform telemetry via mixpanel and supabase |
| `cfo` | finance | L·III |  | Manage Rhinegate subscription economics at $100k-$1M MRR with enterprise ACV profile |
| `cfo.capital` | finance | L·IV |  | Plan Rhinegate capital strategy appropriate to $100k-$1M MRR subscription SaaS |
| `cfo.econ` | finance | L·IV |  | Model Rhinegate unit economics: enterprise ACV, referral CAC, subscription LTV via hubspot/mixpanel signal |
| `cfo.forecast` | finance | L·IV |  | Forecast Rhinegate ARR from high-touch enterprise pipeline with referral-sourced lead flow |
| `cfo.treasury` | finance | L·IV |  | Manage Rhinegate treasury and runway at current MRR band |
| `cmo` | marketing | L·III |  | Lead Rhinegate marketing with enterprise tone; amplify referral-led motion rather than paid acquisition |
| `cmo.advocacy` | marketing | L·IV |  | weight_up: Rhinegate is referral-led — engineer systematic advocacy from enterprise ops customers |
| `cmo.brand` | marketing | L·IV |  | Sharpen Rhinegate positioning as emerging enterprise data governance platform for ops teams |
| `coo` | ops | L·III |  | Run Rhinegate swarm ops across claude-code, supabase, github, slack; coordinate via Slack |
| `coo.connector` | ops | L·IV |  | Maintain Rhinegate connectors: claude-code, supabase, github, slack, mixpanel, hubspot |
| `coo.dashboard` | ops | L·IV |  | Render Rhinegate operator dashboard: referral pipeline, enterprise deals, expansion, unit economics |
| `coo.health` | ops | L·IV |  | Monitor Rhinegate swarm health and surface anomalies in Slack |
| `coo.memory` | ops | L·IV |  | Curate Rhinegate swarm memory across enterprise accounts, referral relationships, and product state |
| `coo.observability` | ops | L·IV |  | Observe Rhinegate swarm execution and connector health; pipe alerts to Slack |
| `coo.scheduler` | ops | L·IV |  | Schedule Rhinegate swarm cadence aligned to high-touch enterprise sales cycle |
| `cpo` | product | L·III |  | Steward Rhinegate enterprise data governance platform — GA product serving enterprise ops teams |
| `cpo.build` | product | L·IV | ✓ | Ship Rhinegate governance platform iterations via github/claude-code; GA maturity — prioritize stability |
| `cpo.growth` | product | L·IV | ✓ | Identify product-led growth levers inside Rhinegate that strengthen referral loops and expansion |
| `cpo.qa` | product | L·IV |  | QA Rhinegate's GA governance platform for enterprise ops teams — zero-tolerance regression bar |
| `cpo.roadmap` | product | L·IV |  | Sequence Rhinegate roadmap around enterprise ops ICP and referral-generating customer wins |
| `cro` | revenue | L·III |  | Drive Rhinegate revenue via high-touch enterprise sales on referral-led pipeline; mixed close channel |
| `cro.close` | revenue | L·IV |  | Close Rhinegate enterprise deals via mixed channel; navigate procurement and security review |
| `cro.demo` | revenue | L·IV |  | Run high-touch enterprise demos of Rhinegate governance platform for ops team evaluators |
| `cro.expansion` | revenue | L·IV | ✓ | weight_up: Rhinegate referral loops extend expansion touchpoints — drive NRR via account expansion and referral capture |

### Parked (3) — not needed yet

| Agent | Unpark condition |
|---|---|
| `cmo.content` | Content-led or inbound motion adopted |
| `cmo.demand` | Inbound lead source becomes primary |
| `cro.outbound` | Outbound sales motion adopted (gtm_profile_enum starts with OUTBOUND_) |

### Spawn eligibility (S+)

- **`cpo.build`** — Rhinegate is GA with live paying customers — build queue depth justifies spawn bursts
- **`cro.expansion`** — Referral-led motion at $100k-$1M MRR — expansion touchpoints and referral capture justify spawns
- **`cdo.signal`** — Rich connector surface (supabase/mixpanel/hubspot) generates signal extraction queue depth
- **`cdo.infer`** — Enterprise expansion/churn inference on referral-sourced accounts justifies concurrent spawns

## Phase 4 · Workflow manifest

*Source: T2 · onboarding/phase-4*

- Agent workflows: 30
- Bundle workflows: 5
- Dry-run gates: **10**
- T2 patches applied: **8**

### T2 patches — per-agent attribution

| Agent | Changed | Pillar signal | Rationale |
|---|---|---|---|
| `cro.expansion` | on_fire, escalation | `pillar_2.stage=live_paying_customers + pillar_3.revenue_model=subscription` | Rhinegate is at live_paying_customers stage with subscription revenue and enterprise ICP, so expansion must prioritize NRR/seat-expansion plays inside existing accounts rather than generic pipeline reads. |
| `cmo.advocacy` | on_fire, escalation | `pillar_2.gtm=REFERRAL_LED` | GTM is REFERRAL_LED for an enterprise ICP, so advocacy is the primary acquisition flywheel and must actively harvest referrals from happy enterprise customers, not just enroll case studies. |
| `cro.demo` | on_fire, escalation | `pillar_5.differentiator=Enterprise data governance platform + pillar_1.icp=enterprise ops teams` | Enterprise data governance demos for live_paying_customers GTM=REFERRAL_LED require qualifying referral source and tailoring around governance differentiator, not a generic pipeline read. |
| `cro.close` | on_fire, escalation | `pillar_1.icp=enterprise ops teams + pillar_4.product_maturity=ga` | Enterprise subscription deals at GA require security/legal review handoffs and procurement-aware closing, not a generic execute_customer_action step. |
| `cpo.qa` | on_fire, escalation | `pillar_4.product_maturity=ga + pillar_5.differentiator=Enterprise data governance platform` | At GA serving enterprise ops teams on a governance platform, QA must monitor production reliability and governance-policy correctness, not generic telemetry classification. |
| `cpo.growth` | on_fire | `pillar_2.gtm=REFERRAL_LED + pillar_3.revenue_model=subscription` | With REFERRAL_LED GTM, growth experiments should focus on in-product referral mechanics and expansion surfaces rather than generic artifact drafting. |
| `cfo.capital` | on_fire | `pillar_2.stage=live_paying_customers + pillar_3.revenue_model=subscription` | For a live_paying_customers subscription business, capital reallocation should weigh CAC payback and NRR-per-agent rather than generic ROI, and budget enforcement must remain dry-run-gated to protect production spend. |
| `cdo.attribute` | on_fire, escalation | `pillar_2.gtm=REFERRAL_LED` | REFERRAL_LED GTM makes referral-source attribution the load-bearing data product; this agent must explicitly trace closed-won revenue back to referrer accounts, not run generic telemetry classification. |

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
| 1 | pull_production_error_and_governance_audit_telemetry | T0 | TLM | — | mixpanel |
| 2 | classify_severity_and_blast_radius | T1 | TLM | — | — |
| 3 | synthesize_quality_insight | T2 | TLM | — | — |
| 4 | emit_tlm_to_chief | T0 | TLM | — | supabase |

_Escalations:_
- `governance_policy_misfire_detected` → `cpo`
- `sev1_affecting_enterprise_account` → `ceo.orchestrator`

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
| 2 | design_referral_or_expansion_experiment | T1 | TLM | — | mixpanel |
| 3 | brand_voice_gate | T2 | VAL | — | — |
| 4 | ship_experiment | T2 | VAL | gated | github |
| 5 | emit_val_to_chief | T0 | VAL | — | supabase |

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
| 1 | watch_for_closed_deals_and_nps_promoters | T0 | VAL | — | hubspot |
| 2 | score_referral_propensity | T1 | TLM | — | mixpanel |
| 3 | draft_referral_request_or_case_study_pitch | T2 | ASN | — | — |
| 4 | send_advocacy_outreach | T2 | VAL | gated | hubspot |
| 5 | emit_val_to_cmo_content | T0 | VAL | — | supabase |

_Escalations:_
- `enterprise_promoter_unresponsive_>14d` → `cmo`
- `referral_volume_drop_>30pct` → `ceo.orchestrator`

**`cro.demo`** — heartbeat 4h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | read_demo_queue_with_referral_source | T0 | TLM | — | hubspot |
| 2 | prepare_governance_focused_demo_brief | T2 | ASN | — | — |
| 3 | execute_demo_followup | T2 | VAL | gated | hubspot |
| 4 | log_outcome_tlm | T0 | TLM | — | supabase |

_Escalations:_
- `governance_capability_gap_raised` → `cpo`
- `referrer_relationship_at_risk` → `cmo.advocacy`

**`cro.close`** — heartbeat 2h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | read_late_stage_pipeline | T0 | TLM | — | hubspot |
| 2 | detect_procurement_or_security_blockers | T1 | TLM | — | hubspot |
| 3 | prepare_close_engagement_brief | T2 | ASN | — | — |
| 4 | execute_close_action | T2 | VAL | gated | hubspot |
| 5 | log_outcome_tlm | T0 | TLM | — | supabase |

_Escalations:_
- `deal_stalled_>21d_in_legal` → `cro`
- `enterprise_deal_>$100k_ARR_at_risk` → `ceo.orchestrator`

**`cro.expansion`** — heartbeat 6h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | pull_account_health_from_hubspot | T0 | TLM | — | hubspot |
| 2 | identify_expansion_signals | T1 | TLM | — | mixpanel |
| 3 | draft_expansion_engagement_brief | T2 | ASN | — | — |
| 4 | execute_expansion_outreach | T2 | VAL | gated | hubspot |
| 5 | log_outcome_tlm | T0 | TLM | — | supabase |

_Escalations:_
- `churn_risk_detected` → `cro`
- `enterprise_account_>$50k_ARR_at_risk` → `ceo.orchestrator`

**`cfo.capital`** — heartbeat 1h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | compute_marginal_roi_with_cac_payback | T0 | TLM | — | supabase |
| 2 | detect_drift | T0 | TLM | — | — |
| 3 | draft_reallocation | T1 | ASN | — | — |
| 4 | narrate_diff_for_board | T2 | TLM | — | — |
| 5 | enforce_new_budgets | T0 | CON | gated | supabase |

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
| 1 | pull_recent_telemetry | T0 | TLM | — | — |
| 2 | classify_or_score | T1 | — | — | — |
| 3 | synthesize_insight | T2 | — | — | — |
| 4 | emit_tlm_to_chief | T0 | TLM | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `cdo`

**`cdo.attribute`** — heartbeat 4h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | pull_pipeline_and_referral_touchpoints | T0 | TLM | — | hubspot |
| 2 | score_referral_attribution | T1 | TLM | — | mixpanel |
| 3 | synthesize_referral_flywheel_insight | T2 | TLM | — | — |
| 4 | emit_tlm_to_chief | T0 | TLM | — | supabase |

_Escalations:_
- `referral_attribution_coverage_<70pct` → `cdo`
- `top_referrer_cohort_NRR_drop` → `cmo.advocacy`

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

### Dry-run gates (10)

- `cfo.capital.enforce_new_budgets`
- `cfo.econ.enforce_new_budgets`
- `cmo.advocacy.send_advocacy_outreach`
- `cmo.brand.publish_or_ship`
- `cpo.build.publish_or_ship`
- `cpo.growth.ship_experiment`
- `cpo.roadmap.publish_or_ship`
- `cro.close.execute_close_action`
- `cro.demo.execute_demo_followup`
- `cro.expansion.execute_expansion_outreach`

## Finalize · strategy review

### Monte Carlo winner
- **Strategy:** Growth-first _(ACQUISITION_HEAVY)_
- _Aggressive top-of-funnel investment, higher variance_
- **Mode:** `growth`
- Projected 30-cycle MRR growth: **13881%** · confidence: high (sharpe 0.54).

**Rationale:**
> ACQUISITION_HEAVY wins: sharpe 0.54 (next BALANCED at 0.53, 2% lead). Mean MRR growth 13880.6%, p(auto-catalytic) 100%, p(ruin) 0%.

### Imprint review

> Rhinegate operates an enterprise data governance platform serving Fortune 1000 CISOs, with 18 customers averaging $80k/year contracts for $1.5M ARR. The product is live with paying customers in the $100k–$1M MRR band. Go-to-market is referral-led: champions drive roughly 80% of pipeline, and deals close through RFPs and executive relationships over a 6–9 month cycle.
>
> The swarm runs 30 of 33 agents active, with three parked and none disabled. The parked set — cmo.demand, cmo.content, and cro.outbound — reflects the referral-led motion, where broad demand generation, content production, and cold outbound are not the primary growth levers given that champions and executive relationships carry the pipeline. Required connectors are claude-code, supabase, github, and slack, with mixpanel and hubspot suggested as secondary. Board communications run through Slack, using a digest cadence with urgent items escalated by phone. Claude Code is on the max_20x plan, verified.
>
> The Monte Carlo winner is ACQUISITION_HEAVY, meaning capital and agent attention concentrate on pulling new logos through the referral and RFP funnel rather than expanding or retention-focused plays. Across 30 cycles the mean MRR growth is 13,881%, with auto-catalytic probability at 100% and probability of ruin at 0%. Cycles-to-critical sits at 2.83, so the model expects Rhinegate to cross its critical threshold in roughly three cycles. The Sharpe ratio of 0.54 indicates positive risk-adjusted return but meaningful variance — the upside is real, but the path is not smooth.
>
> The dry-run window is 14 days starting 2026-05-06, during which 10 tasks across the swarm are gated and will not execute writes without operator approval. These held tasks are the points where the operator needs to review intent, scope, and blast radius before the swarm is allowed to act on live systems. Approvals during this window determine which automated behaviors carry into production once the dry-run closes.

### Dry-run window
- Dry-run on: **true** · expires **2026-05-06T13:59:51.929Z**
- Manifest hash: `sha256:f48f5091c4a0b66f840db02e1368feb958565127089aac73a3453fd4de1be27d`

## Run metadata

| Phase | Elapsed (ms) |
|---|---:|
| pillar_1_ms | 1 |
| pillar_2_ms | 1 |
| pillar_3_5_ms | 1 |
| phase_2_ms | 10101 |
| phase_3_ms | 31461 |
| phase_4_ms | 61294 |
| finalize_ms | 13412 |
| **Total T2 calls** | **4** |

