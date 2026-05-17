# Variant report · vm05-regulated-fintech

*Pipeline mode:* **LIVE T2**
*Fixture description:* Validation matrix F5 · Regulated fintech, $28k MRR, compliance-heavy. Expected: compliance emphasis despite sub-scale, growth MC efficiency-weighted.

## Operator inputs (Pillars 1–5)

- **Company:** Solmark · `https://solmark.example`
- **Claude plan:** max_20x
- **Stage:** live_paying_customers · $10k–$100k MRR
- **Lead sources:** content_seo, referral_word_of_mouth
- **Sales motion:** self_serve_plg
- **Board comms:** slack · digest_plus_urgent_phone

## Phase 1 · Pillar 1 enrichment

- **Enrichment status:** `enriched`
- **Industry hint:** fintech
- **Business model:** subscription
- **Has product:** yes
- **Ideal customer profile:** regional banks + credit unions
- **Revenue model:** subscription
- **Competitive position:** emerging
- **Primary acquisition channel:** content seo
- **Product maturity signal:** ga
- **Tone signal:** enterprise
- **Primary friction hypothesis:** friction point not clearly specified — infer from GTM stage
- **Differentiator hypothesis:** Neobank for freelancers

**Company context:**
> Neobank for freelancers. FDIC-insured via partner bank. Free tier plus $15/mo premium. 3,500 customers, $28k MRR. Growth via referral and content. Heavy compliance burden.

## Phase 2 · Connector manifest

*Source: T2 · onboarding/phase-2*

| Bucket | Count | Connectors |
|---|---:|---|
| Required | 4 | `claude-code`, `github`, `slack`, `supabase` |
| Suggested | 2 | `mixpanel`, `plaid` |
| Deferred | 0 | — |
| Blocked on approval | 1 | `supabase` |

### Required — details

| ID | Priority | Status | Dry-run | Rationale |
|---|---|---|---|---|
| Claude Code (inference) | P-1 | configured | — | Inference substrate for Solmark's Board — verified during Pillar 2 on max_20x plan. |
| GitHub (code + ship events) | P1 | pending_credential | — | Solmark is live/GA — cpo correlates merges to activation; cdo joins ship events to paying-customer cohorts. |
| Slack (Board notifications) | P0 | pending_credential | no | Pillar 5 chose Slack — digest + urgent-phone routing for CEO↔Board comms. |
| Supabase (data + auth) | P-1 | pending_credential | yes | Fintech audit substrate — every Solmark customer event retained per FDIC-partner compliance window. |

### Suggested — details

| ID | Priority | Status | Rationale |
|---|---|---|---|
| Mixpanel (product analytics) | P1 | pending_decision | Content-led PLG + referral loop — cro.expansion and cmo.advocacy need telemetry to find freelancer champions. |
| Plaid (compliant banking data) | P1 | pending_decision | Neobank for freelancers — Plaid lets cfo.econ and cdo.attribute reconcile off-platform freelancer cashflows. |

### Blocked on manual approval

- **Supabase (data + auth)** — Service-role key grants read+write across Solmark's regulated event tables — operator must review dry_run before go-live.

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
| Customer insight & activation | 18% |
| Pipeline & conversion | 22% |
| Retention & expansion | 18% |
| Efficiency & runway | 22% |
| Positioning & narrative | 20% |

### Active agents (28)

| Agent | Department | Level | S+ | Skill overlay |
|---|---|---|:-:|---|
| `ceo.orchestrator` | ceo | L·II |  | Solmark orchestration: neobank-for-freelancers at $10k–100k MRR; coordinate content-led PLG motion across fintech-regulated surfaces |
| `cdo` | data | L·III |  | Solmark data: mixpanel + supabase event trail for PLG activation and fintech audit readiness |
| `cdo.attribute` | data | L·IV |  | Solmark attribution: content-SEO + referral lead sources mapped to subscription cohorts |
| `cdo.infer` | data | L·IV | ✓ | Solmark inference: churn and expansion propensity across the live paying freelancer base |
| `cdo.signal` | data | L·IV | ✓ | Solmark signal: mixpanel activation/funnel signals for freelancer onboarding under content-led PLG |
| `cdo.telemetry` | data | L·IV |  | Solmark telemetry: supabase + mixpanel event pipeline held to fintech audit bar |
| `cfo` | finance | L·III |  | Solmark finance: fintech unit economics at $10k–100k MRR; plaid-backed cash flow visibility |
| `cfo.capital` | finance | L·IV |  | Solmark capital planning: fintech runway at $10k–100k MRR with regulatory reserve considerations |
| `cfo.econ` | finance | L·IV |  | regulated_compliance: Solmark LTV/CAC reporting must withstand regulator audit; structured event trail via supabase |
| `cfo.forecast` | finance | L·IV |  | Solmark forecast: subscription MRR curve for freelancer neobank, content-SEO-driven pipeline |
| `cfo.treasury` | finance | L·IV |  | Solmark treasury: plaid-integrated cash visibility; fintech segregation and compliance posture |
| `cmo` | marketing | L·III |  | Solmark demand: content-led PLG targeting regional banks + credit unions ICP with enterprise tone |
| `cmo.content` | marketing | L·IV | ✓ | weight_up: primary demand driver under content/PLG — Solmark SEO surface targeting freelancer + regional-bank/credit-union audiences |
| `cmo.demand` | marketing | L·IV | ✓ | ad_bidding_workflows_disabled: no ad-platform connector in Solmark manifest — demand capture is organic/content-driven only |
| `coo` | ops | L·III |  | Solmark ops: slack-native comms, github + claude-code delivery loop, supabase as source of truth |
| `coo.connector` | ops | L·IV |  | Solmark connectors: claude-code, github, slack, supabase required; mixpanel + plaid suggested |
| `coo.dashboard` | ops | L·IV |  | Solmark dashboards: slack-delivered enterprise-tone briefings on PLG activation and MRR |
| `coo.health` | ops | L·IV |  | Solmark health: GA uptime expectations for a regulated freelancer neobank |
| `coo.memory` | ops | L·IV |  | Solmark memory: supabase-backed long-term state for regulator-grade decision provenance |
| `coo.observability` | ops | L·IV |  | Solmark observability: github + supabase + mixpanel trace fabric for fintech incident forensics |
| `coo.scheduler` | ops | L·IV |  | Solmark scheduling: pace content-led PLG cadence against fintech change-management windows |
| `cpo` | product | L·III |  | Solmark GA product oversight: freelancer neobank UX held to fintech trust/compliance bar |
| `cpo.build` | product | L·IV | ✓ | Solmark build velocity: ship against GA freelancer neobank surface via github + claude-code |
| `cpo.growth` | product | L·IV | ✓ | weight_up: activation loops matter most — Solmark freelancer onboarding → first-funded-account is the load-bearing PLG step |
| `cpo.qa` | product | L·IV |  | Solmark QA: fintech-grade regression coverage on live paying freelancer accounts |
| `cpo.roadmap` | product | L·IV |  | Solmark roadmap: emerging fintech entrant at $10k–100k MRR — sequence for differentiation vs. incumbent neobanks |
| `cro` | revenue | L·III |  | Solmark revenue: subscription self-serve PLG — expansion-weighted, no outbound/demo motion |
| `cro.expansion` | revenue | L·IV | ✓ | Solmark expansion: subscription-tier upsell and per-freelancer account depth — only live revenue lever given parked outbound/demo/close |

### Parked (5) — not needed yet

| Agent | Unpark condition |
|---|---|
| `cmo.advocacy` | Stage reaches 100k_1m_mrr or referral motion adopted |
| `cmo.brand` | Stage reaches 100k_1m_mrr (positioning becomes load-bearing) |
| `cro.close` | Sales motion becomes assisted_demo or high_touch_enterprise |
| `cro.demo` | Sales motion becomes assisted_demo or high_touch_enterprise |
| `cro.outbound` | Outbound sales motion adopted (gtm_profile_enum starts with OUTBOUND_) |

### Spawn eligibility (S+)

- **`cpo.build`** — Solmark is GA with live paying freelancers — build queue will justify spawning within 30 cycles
- **`cpo.growth`** — weight_up: activation loops are the load-bearing PLG step for Solmark's freelancer onboarding
- **`cmo.content`** — weight_up: content SEO is Solmark's primary demand driver — content queue will saturate early
- **`cro.expansion`** — Only live revenue lever given parked outbound/demo/close — expansion workload concentrates here
- **`cdo.signal`** — Mixpanel activation funnels for freelancer onboarding generate high-frequency signal work
- **`cdo.infer`** — Churn/expansion propensity across the live paying freelancer base justifies spawn capacity

## Phase 4 · Workflow manifest

*Source: T2 · onboarding/phase-4*

- Agent workflows: 28
- Bundle workflows: 5
- Dry-run gates: **11**
- T2 patches applied: **9**

### T2 patches — per-agent attribution

| Agent | Changed | Pillar signal | Rationale |
|---|---|---|---|
| `cmo.content` | on_fire, escalation | `pillar_2.primary_acquisition=content_seo` | Solmark's primary acquisition is content SEO under a CONTENT_LED_PLG motion targeting regional banks and credit unions, so cmo.content needs SEO-keyword-driven briefs and an enterprise-tone brand gate rather than a generic publish loop. |
| `cmo.demand` | on_fire, escalation | `pillar_2.gtm_profile=CONTENT_LED_PLG` | Solmark is GA + content-led PLG selling to regulated regional banks/credit unions, so cmo.demand should source leads from organic content engagement (not cold prospecting) and quality-gate every outbound send to enterprise compliance norms. |
| `cro.expansion` | on_fire, escalation | `pillar_1.stage=live_paying_customers` | Solmark has live paying customers on a subscription model selling to regional banks/credit unions, so cro.expansion should mine the existing subscription base for upsell signals via Plaid/Supabase and run an enterprise-tone brief rather tha |
| `cfo.capital` | on_fire | `pillar_1.revenue_model=subscription` | Solmark is GA with subscription revenue and content-SEO acquisition, so cfo.capital should weight ROI by content/CAC payback (not generic per-agent ROI) and gate budget enforcement to protect the live revenue base. |
| `cdo.attribute` | on_fire | `pillar_2.primary_acquisition=content_seo` | Because Solmark's primary acquisition is content SEO and revenue is subscription, cdo.attribute should run content-touch attribution (organic landing page → trial → paid subscription) instead of the generic telemetry loop. |
| `cdo.signal` | on_fire | `pillar_1.icp=regional_banks_and_credit_unions` | Solmark's ICP is regulated regional banks/credit unions reached via content SEO, so cdo.signal should specifically mine SEO/SERP and bank-vertical signals rather than generic telemetry. |
| `cpo.qa` | on_fire, escalation | `pillar_1.product_maturity=ga` | Solmark is GA serving regional banks and credit unions where compliance defects are existential, so cpo.qa needs an explicit regulated-vertical defect classifier and a fast escalation path to cpo on any compliance-class issue. |
| `cpo.growth` | on_fire, escalation | `pillar_2.gtm_profile=CONTENT_LED_PLG` | Under CONTENT_LED_PLG into regional banks/credit unions, cpo.growth experiments must publish via PR/preview (github) and pass a compliance-aware brand gate, not the generic ship loop. |
| `coo.connector` | on_fire, escalation | `pillar_4.connectors=plaid,supabase,mixpanel,slack,github,claude-code` | Solmark depends on Plaid + Supabase + Mixpanel for live paying-customer flows in a banking ICP, so coo.connector must check those specific connectors and escalate Plaid failures fast given financial-data sensitivity. |

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
| 1 | pull_recent_telemetry | T0 | TLM | — | mixpanel |
| 2 | classify_defects_by_compliance_risk | T1 | TLM | — | — |
| 3 | synthesize_ga_quality_insight | T2 | TLM | — | — |
| 4 | emit_tlm_to_chief | T0 | TLM | — | — |

_Escalations:_
- `defect_class=compliance` → `cpo`
- `paying_customer_impact_detected` → `cpo`

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
| 2 | draft_experiment_artifact | T1 | VAL | — | — |
| 3 | compliance_brand_voice_gate | T2 | VAL | gated | — |
| 4 | publish_or_ship | T2 | VAL | gated | github |
| 5 | emit_val_to_chief | T0 | VAL | — | — |

_Escalations:_
- `compliance_brand_voice_gate=fail` → `cpo`
- `experiment_touches_paying_customers` → `cpo`

**`cmo.demand`** — heartbeat 2h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | pull_content_engaged_leads | T0 | TLM | — | mixpanel |
| 2 | score_leads_by_icp_fit | T0 | TLM | — | supabase |
| 3 | personalize_sequences | T1 | VAL | — | — |
| 4 | compliance_quality_gate | T2 | VAL | gated | — |
| 5 | send_outbound_messages | T0 | VAL | gated | slack |
| 6 | emit_val_to_chief | T0 | VAL | — | — |

_Escalations:_
- `compliance_quality_gate=fail` → `cmo`
- `icp_fit_score<threshold for full batch` → `cmo`

**`cmo.content`** — heartbeat 4h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | read_asn_from_chief | T0 | ASN | — | — |
| 2 | pull_seo_keyword_gaps | T0 | TLM | — | mixpanel |
| 3 | draft_artifact | T1 | VAL | — | — |
| 4 | enterprise_tone_brand_gate | T2 | VAL | gated | — |
| 5 | publish_or_ship | T2 | VAL | gated | github |
| 6 | emit_val_to_chief | T0 | VAL | — | — |

_Escalations:_
- `enterprise_tone_brand_gate=fail` → `cmo`
- `keyword_gap_empty_for_3_cycles` → `cmo`

**`cro.expansion`** — heartbeat 6h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | read_subscription_pipeline | T0 | TLM | — | supabase |
| 2 | pull_account_financial_signals | T0 | TLM | — | plaid |
| 3 | prepare_enterprise_engagement_brief | T2 | VAL | — | — |
| 4 | execute_customer_action | T2 | VAL | gated | slack |
| 5 | log_outcome_tlm | T0 | TLM | — | supabase |

_Escalations:_
- `churn_risk_signal_detected` → `cro`
- `enterprise_brief_requires_legal_review` → `cro`

**`cfo.capital`** — heartbeat 1h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | compute_marginal_roi_per_agent | T0 | TLM | — | mixpanel |
| 2 | detect_drift | T0 | TLM | — | — |
| 3 | draft_reallocation | T0 | VAL | — | — |
| 4 | narrate_diff_for_board | T2 | VAL | — | — |
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
| 1 | pull_serp_and_vertical_signals | T0 | TLM | — | mixpanel |
| 2 | classify_or_score | T1 | TLM | — | — |
| 3 | synthesize_insight | T2 | TLM | — | — |
| 4 | emit_tlm_to_chief | T0 | TLM | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `cdo`

**`cdo.attribute`** — heartbeat 4h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | pull_content_touch_events | T0 | TLM | — | mixpanel |
| 2 | build_multi_touch_attribution | T1 | TLM | — | supabase |
| 3 | synthesize_seo_roi_insight | T2 | TLM | — | — |
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
| 1 | run_check | T0 | — | — | — |
| 2 | summarize_if_anomaly | T1 | — | — | — |
| 3 | emit_tlm_to_coo | T0 | TLM | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `coo`

**`coo.connector`** — heartbeat 1h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | run_check | T0 | TLM | — | plaid |
| 2 | summarize_if_anomaly | T1 | TLM | — | — |
| 3 | emit_tlm_to_coo | T0 | TLM | — | — |

_Escalations:_
- `plaid_unhealthy` → `coo`
- `supabase_unhealthy` → `coo`

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

### Dry-run gates (11)

- `cfo.capital.enforce_new_budgets`
- `cfo.econ.enforce_new_budgets`
- `cmo.content.enterprise_tone_brand_gate`
- `cmo.content.publish_or_ship`
- `cmo.demand.compliance_quality_gate`
- `cmo.demand.send_outbound_messages`
- `cpo.build.publish_or_ship`
- `cpo.growth.compliance_brand_voice_gate`
- `cpo.growth.publish_or_ship`
- `cpo.roadmap.publish_or_ship`
- `cro.expansion.execute_customer_action`

## Finalize · strategy review

### Monte Carlo winner
- **Strategy:** Runway-first _(CAPITAL_EFFICIENT)_
- _Preserve capital while validating product-market fit_
- **Mode:** `growth`
- Projected 30-cycle MRR growth: **1105%** · confidence: moderate (sharpe 0.36).

**Rationale:**
> CAPITAL_EFFICIENT wins: sharpe 0.36 (next RETENTION_FIRST at 0.21, 71% lead). Mean MRR growth 1105.0%, p(auto-catalytic) 97%, p(ruin) 0%.

### Imprint review

> Solmark is a neobank for freelancers, FDIC-insured through a partner bank, running a free tier alongside a $15/month premium plan. The business is live with paying customers — 3,500 of them generating $28k MRR — and sits in the $10k–$100k MRR band. Growth is content-led PLG, leaning on referral loops and organic content rather than outbound, which fits the freelancer audience and the heavy compliance burden the product carries.
>
> The deployed swarm is 28 of 33 agents active, with 5 parked and none disabled. The parked roster is concentrated on the go-to-market side — cmo.brand and cmo.advocacy on the marketing side, and cro.outbound, cro.demo, and cro.close on revenue — which is consistent with a content-led PLG motion where outbound sales and brand-led demand generation are not yet the right investment. Required connectors are claude-code, github, slack, and supabase, with mixpanel and plaid suggested to round out product analytics and banking data. Board communication runs through Slack as a digest, with urgent items escalated by phone. Claude Code is on the max_20x plan, verified.
>
> The Monte Carlo winner is CAPITAL_EFFICIENT. Across 30 cycles the strategy shows a mean MRR growth of 1,105%, a 97% probability of going auto-catalytic, and a 0% probability of ruin, with cycles-to-critical at roughly 16.5. Sharpe sits at 0.36, which is modest — the expected return is strong and the downside is bounded, but the path is volatile enough that the risk-adjusted read is moderate rather than exceptional. For a regulated neobank, the zero-ruin profile is the load-bearing number.
>
> The dry-run window opens 2026-05-06 and runs 14 days. During that period, 11 tasks across the swarm are gated and will not write to live systems until reviewed. The operator's job in this window is to walk those 11 held tasks, confirm the intended action against Solmark's compliance posture, and approve them individually before the swarm transitions out of dry-run. After the 14 days, anything left ungated will move to live execution under the CAPITAL_EFFICIENT strategy.

### Dry-run window
- Dry-run on: **true** · expires **2026-05-06T14:01:48.204Z**
- Manifest hash: `sha256:bb43bb4f16c02384592f8b4794363752094d2fa876dd6c091f7903dc22330e5e`

## Run metadata

| Phase | Elapsed (ms) |
|---|---:|
| pillar_1_ms | 1 |
| pillar_2_ms | 1 |
| pillar_3_5_ms | 2 |
| phase_2_ms | 11154 |
| phase_3_ms | 34717 |
| phase_4_ms | 64434 |
| finalize_ms | 17034 |
| **Total T2 calls** | **4** |

