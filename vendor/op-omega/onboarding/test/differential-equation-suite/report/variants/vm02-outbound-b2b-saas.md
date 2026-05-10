# Variant report · vm02-outbound-b2b-saas

*Pipeline mode:* **LIVE T2**
*Fixture description:* Validation matrix F2 · Outbound-led B2B SaaS at $15k MRR. Expected: mid swarm (14-18), Supabase+Mixpanel+Slack, growth MC.

## Operator inputs (Pillars 1–5)

- **Company:** Lexworth · `https://lexworth.example`
- **Claude plan:** max_20x
- **Stage:** live_paying_customers · $10k–$100k MRR
- **Lead sources:** outbound_cold
- **Sales motion:** assisted_demo
- **Board comms:** slack · digest_plus_urgent_phone

## Phase 1 · Pillar 1 enrichment

- **Enrichment status:** `enriched`
- **Industry hint:** legal_tech
- **Business model:** subscription
- **Has product:** yes
- **Ideal customer profile:** mid-market ops teams
- **Revenue model:** subscription seat
- **Competitive position:** emerging
- **Primary acquisition channel:** outbound sales
- **Product maturity signal:** ga
- **Tone signal:** friendly
- **Primary friction hypothesis:** friction point not clearly specified — infer from GTM stage
- **Differentiator hypothesis:** AI-powered contract review tool for mid-market legal teams at manufacturers

**Company context:**
> AI-powered contract review tool for mid-market legal teams at manufacturers. Customers pay $2k-$5k/mo per seat. 8 customers, $15k MRR, growing via outbound sales on LinkedIn and cold email.

## Phase 2 · Connector manifest

*Source: T2 · onboarding/phase-2*

| Bucket | Count | Connectors |
|---|---:|---|
| Required | 4 | `claude-code`, `github`, `slack`, `supabase` |
| Suggested | 1 | `mixpanel` |
| Deferred | 1 | `linkedin-sales-nav` |
| Blocked on approval | 1 | `supabase` |

### Required — details

| ID | Priority | Status | Dry-run | Rationale |
|---|---|---|---|---|
| Claude Code (inference) | P-1 | configured | — | Inference bootstrap for Lexworth — verified max_20x plan during Pillar 2. |
| GitHub (code + ship events) | P1 | pending_credential | — | Lexworth is GA with paying seats — correlate merges/deploys to seat activation for 8 live customers. |
| Slack (Board notifications) | P0 | pending_credential | no | Pillar 5 channel — digest + urgent routing to Lexworth CEO per OUTBOUND_MID_MARKET cadence. |
| Supabase (data + auth) | P-1 | pending_credential | yes | Legal-tech contract review — audit-trail substrate for every customer event; required for mid-market compliance. |

### Suggested — details

| ID | Priority | Status | Rationale |
|---|---|---|---|
| Mixpanel (product analytics) | P1 | pending_decision | Seat-level activation telemetry for $2k-$5k/mo Lexworth customers — anomaly detection beyond raw Supabase events. |

### Blocked on manual approval

- **Supabase (data + auth)** — Supabase service-role key grants read+write on all tables. Operator must review + approve dry_run before any writes go live.

## Phase 3 · Swarm manifest

*Source: T2 · onboarding/phase-3*

### Topology
- Total base roster: **33**
- Active: **29**
- Standby: 0
- Parked: 4
- Disabled: 0

### Bundle allocation

| Bundle | Weight |
|---|---:|
| Customer insight & activation | 12% |
| Pipeline & conversion | 29% |
| Retention & expansion | 16% |
| Efficiency & runway | 22% |
| Positioning & narrative | 20% |

### Active agents (29)

| Agent | Department | Level | S+ | Skill overlay |
|---|---|---|:-:|---|
| `ceo.orchestrator` | ceo | L·II |  | Orchestrating Lexworth's swarm at $10k-100k MRR; outbound mid-market motion targeting legal ops teams at manufacturers |
| `cdo` | data | L·III |  | Own Lexworth's data layer across supabase + github + mixpanel; feed pipeline and product signal to chiefs |
| `cdo.attribute` | data | L·IV |  | Attribute Lexworth closed-won revenue to outbound cold sequences and demo touches |
| `cdo.infer` | data | L·IV | ✓ | Infer friction hotspots in Lexworth contract-review usage for mid-market legal ops accounts |
| `cdo.signal` | data | L·IV | ✓ | Surface product and pipeline signal from Lexworth supabase + mixpanel + github activity |
| `cdo.telemetry` | data | L·IV |  | Wire Lexworth product telemetry via mixpanel + supabase for GA contract-review flows |
| `cfo` | finance | L·III |  | Manage Lexworth unit economics at $10k-100k MRR seat-subscription; watch CAC payback on outbound motion |
| `cfo.capital` | finance | L·IV |  | Manage Lexworth capital plan at $10k-100k MRR emerging stage |
| `cfo.econ` | finance | L·IV |  | Track Lexworth LTV/CAC on outbound-sourced seat subscriptions; structured event trail via supabase |
| `cfo.forecast` | finance | L·IV |  | Forecast Lexworth ARR and seat growth from outbound pipeline |
| `cfo.treasury` | finance | L·IV |  | Run Lexworth treasury and burn discipline through the $10k-100k MRR band |
| `cmo` | marketing | L·III |  | Own positioning for Lexworth as emerging AI contract-review tool for mid-market legal teams at manufacturers; friendly tone |
| `coo` | ops | L·III |  | Run Lexworth's operational backbone on slack comms with claude-code / github / supabase / mixpanel connectors |
| `coo.connector` | ops | L·IV |  | Maintain Lexworth connector fleet: claude-code, github, slack, supabase, mixpanel |
| `coo.dashboard` | ops | L·IV |  | Render Lexworth operator dashboard: outbound pipeline, seat MRR, GA product health |
| `coo.health` | ops | L·IV |  | Monitor Lexworth swarm health across claude-code, github, slack, supabase, mixpanel |
| `coo.memory` | ops | L·IV |  | Curate Lexworth swarm memory of mid-market legal-ops accounts and deal history |
| `coo.observability` | ops | L·IV |  | Observe Lexworth swarm decisions and outbound motion outcomes via slack + supabase |
| `coo.scheduler` | ops | L·IV |  | Schedule Lexworth swarm cycles against outbound cadence and demo calendar |
| `cpo` | product | L·III |  | Steward Lexworth's GA contract-review product; prioritize friction removal for mid-market legal ops users already paying |
| `cpo.build` | product | L·IV | ✓ | Ship GA-quality iterations on Lexworth contract-review product via claude-code + github |
| `cpo.growth` | product | L·IV | ✓ | Drive activation and seat-expansion inside Lexworth accounts once outbound demos convert |
| `cpo.qa` | product | L·IV |  | Guard GA reliability of Lexworth's contract-review output; paying customers set the quality bar |
| `cpo.roadmap` | product | L·IV |  | Sequence Lexworth roadmap against mid-market legal-ops demo feedback from outbound deals |
| `cro` | revenue | L·III |  | Run outbound mid-market revenue motion for Lexworth; assisted demos closed via phone/video into legal ops ICP |
| `cro.close` | revenue | L·IV |  | weight_up: close Lexworth seat-subscription deals on phone/video after assisted demo |
| `cro.demo` | revenue | L·IV |  | weight_up: run assisted demos of Lexworth contract review for mid-market legal ops buyers over phone/video |
| `cro.expansion` | revenue | L·IV | ✓ | Grow seats inside existing Lexworth legal-ops accounts; seat-based revenue rewards account expansion |
| `cro.outbound` | revenue | L·IV | ✓ | weight_up: primary spawn target — Lexworth's outbound cold motion into mid-market legal ops is the sole lead source |

### Parked (4) — not needed yet

| Agent | Unpark condition |
|---|---|
| `cmo.advocacy` | Stage reaches 100k_1m_mrr or referral motion adopted |
| `cmo.brand` | Stage reaches 100k_1m_mrr (positioning becomes load-bearing) |
| `cmo.content` | Content-led or inbound motion adopted |
| `cmo.demand` | Inbound lead source becomes primary |

### Spawn eligibility (S+)

- **`cpo.build`** — Lexworth is GA with paying customers — build queue will justify spawn within 30 cycles
- **`cpo.growth`** — Seat-subscription at $10k-100k MRR rewards activation/expansion work inside Lexworth accounts
- **`cro.outbound`** — Outbound cold is Lexworth's sole lead source — primary spawn target
- **`cro.expansion`** — Seat-based revenue model makes expansion load-bearing as Lexworth accounts mature
- **`cdo.signal`** — Supabase + mixpanel wired; signal extraction will queue work for Lexworth chiefs
- **`cdo.infer`** — Friction hypothesis unspecified — inference queue will justify spawn to locate Lexworth's primary friction

## Phase 4 · Workflow manifest

*Source: T2 · onboarding/phase-4*

- Agent workflows: 29
- Bundle workflows: 5
- Dry-run gates: **12**
- T2 patches applied: **9**

### T2 patches — per-agent attribution

| Agent | Changed | Pillar signal | Rationale |
|---|---|---|---|
| `cro.outbound` | on_fire, escalation | `pillar_2.gtm=OUTBOUND_MID_MARKET; pillar_3.icp=mid-market ops teams at manufacturers` | Lexworth's primary acquisition is OUTBOUND_MID_MARKET targeting mid-market legal/ops teams at manufacturers, so the outbound flow needs ICP-specific firmographic filtering (manufacturer + legal team size) and a manual approval gate before a |
| `cro.demo` | on_fire | `pillar_4.differentiator=AI-powered contract review tool for mid-market legal teams at manufacturers; pillar_5.tone=frien` | Lexworth sells AI contract review to mid-market legal teams at manufacturers — demos must rehearse a manufacturer-specific contract (MSA/supplier agreement) walkthrough rather than a generic product tour, and the friendly-tone brief needs t |
| `cro.close` | on_fire, escalation | `pillar_2.revenue_model=subscription seat; pillar_2.gtm=OUTBOUND_MID_MARKET` | Subscription-seat revenue at mid-market means closes hinge on seat-count negotiation and procurement/legal review at the buyer side — Lexworth needs an explicit seat-pricing brief and a CFO loop on non-standard discounts before any contract |
| `cro.expansion` | on_fire | `pillar_2.revenue_model=subscription seat; pillar_2.stage=live_paying_customers; pillar_3.product_maturity=ga` | With a GA product on subscription-seat pricing and live paying customers, expansion is the highest-leverage revenue lever — the agent should be driven by per-account seat-utilization signals from Mixpanel rather than a generic pipeline queu |
| `cpo.qa` | on_fire, escalation | `pillar_4.differentiator=AI-powered contract review tool for mid-market legal teams; pillar_3.product_maturity=ga` | Lexworth's differentiator is AI contract review accuracy — for a GA product serving legal teams, QA must specifically sample model outputs against ground-truth redlines and escalate accuracy regressions immediately, not generically score te |
| `cpo.growth` | on_fire | `pillar_2.primary_acquisition=outbound sales; pillar_3.icp=mid-market ops teams at manufacturers` | Since Lexworth's primary acquisition is outbound (not PLG), the growth agent's most useful artifact is sales-enablement content (manufacturer case studies, ROI calculators, objection-handling collateral) feeding cro.outbound — not generic g |
| `cdo.signal` | on_fire | `pillar_2.gtm=OUTBOUND_MID_MARKET; pillar_3.icp=mid-market ops teams at manufacturers` | For an outbound mid-market motion, the highest-value data signal is intent/buying-trigger detection on manufacturer accounts (M&A, GC hires, supplier disputes) — not generic telemetry classification. |
| `coo.health` | on_fire, escalation | `pillar_2.stage=live_paying_customers; pillar_3.product_maturity=ga` | Live paying customers on a GA product mean any contract-review service degradation is revenue-impacting — health checks must specifically include the model inference path and connector latency, with fast escalation rather than generic anoma |
| `cfo.capital` | on_fire | `pillar_2.revenue_model=subscription seat; pillar_2.primary_acquisition=outbound sales` | With a live subscription-seat business and outbound-led GTM, capital reallocation should be explicitly tied to CAC-payback and seat-NRR per agent — not just marginal ROI in the abstract — so the CEO sees revenue-grade reasoning. |

### Bundle workflows

| Bundle | Owner | Cycle | KPIs moved |
|---|---|---|---|
| Customer insight & activation | `cpo.growth` | 24h | activation_rate, ttv_hours, nrr |
| Pipeline & conversion | `cro.chief` | 1w | cac, sales_cycle_days, win_rate, mrr |
| Retention & expansion | `cro.expansion` | per-account | nrr, grr, referral_rate, mrr, inbound_quality |
| Efficiency & runway | `cfo.capital` | 1d | burn_multiple, cac_payback_months, cac |
| Positioning & narrative | `cmo.brand` | 1mo | narrative_strength, inbound_quality, sales_cycle_days, win_rate |

### Active-agent workflows (29)

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
| 1 | pull_recent_contract_review_outputs | T0 | TLM | — | supabase |
| 2 | score_redline_accuracy_vs_ground_truth | T1 | — | — | claude-code |
| 3 | synthesize_accuracy_regression_insights | T2 | — | — | claude-code |
| 4 | emit_tlm_to_chief | T0 | TLM | — | — |

_Escalations:_
- `accuracy_drop_>5pct_24h` → `cpo`
- `customer_reject_rate_>15pct` → `ceo.orchestrator`

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
| 2 | draft_manufacturer_proof_artifact | T1 | — | — | claude-code |
| 3 | brand_voice_gate | T2 | CON | gated | slack |
| 4 | publish_to_sales_enablement_library | T2 | VAL | gated | github |
| 5 | emit_val_to_chief | T0 | VAL | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `cpo`

**`cro.outbound`** — heartbeat 2h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | pull_new_leads_from_icp_filters | T0 | TLM | — | supabase |
| 2 | score_leads_on_contract_review_pain | T1 | TLM | — | supabase |
| 3 | personalize_sequences_with_manufacturer_proof | T1 | — | — | claude-code |
| 4 | quality_gate_high_value_accounts | T2 | CON | gated | slack |
| 5 | send_outbound_messages | T0 | VAL | gated | slack |
| 6 | emit_val_to_chief | T0 | VAL | — | — |

_Escalations:_
- `reply_rate_below_2pct_over_72h` → `cro`
- `icp_match_rate_below_30pct` → `cmo`

**`cro.demo`** — heartbeat 4h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | read_pipeline_queue | T0 | TLM | — | supabase |
| 2 | prepare_manufacturer_contract_demo_brief | T2 | — | — | claude-code |
| 3 | execute_demo_with_live_redline | T2 | VAL | gated | slack |
| 4 | log_outcome_and_objections_tlm | T0 | TLM | — | supabase |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `cro`

**`cro.close`** — heartbeat 2h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | read_pipeline_queue | T0 | TLM | — | supabase |
| 2 | prepare_seat_pricing_and_legal_brief | T2 | — | — | claude-code |
| 3 | discount_governance_check | T2 | CON | gated | slack |
| 4 | send_proposal_and_contract | T2 | VAL | gated | slack |
| 5 | log_close_outcome_tlm | T0 | TLM | — | supabase |

_Escalations:_
- `discount_request_above_25pct` → `cfo`
- `legal_redline_blocking_>10d` → `cro`

**`cro.expansion`** — heartbeat 6h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | pull_seat_utilization_and_usage_signals | T0 | TLM | — | mixpanel |
| 2 | identify_expansion_motion | T1 | — | — | claude-code |
| 3 | prepare_expansion_brief | T2 | — | — | claude-code |
| 4 | execute_expansion_outreach | T2 | VAL | gated | slack |
| 5 | log_outcome_tlm | T0 | TLM | — | supabase |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `cro`

**`cfo.capital`** — heartbeat 1h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | compute_cac_payback_and_nrr_per_agent | T0 | TLM | — | supabase |
| 2 | detect_drift_vs_target | T0 | — | — | — |
| 3 | draft_reallocation_proposal | T1 | — | — | claude-code |
| 4 | narrate_diff_for_board | T2 | — | — | claude-code |
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
| 1 | pull_intent_signals_for_icp | T0 | TLM | — | supabase |
| 2 | classify_buying_triggers | T1 | — | — | claude-code |
| 3 | synthesize_account_priority_list | T2 | — | — | claude-code |
| 4 | emit_tlm_to_chief | T0 | TLM | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `cdo`

**`cdo.attribute`** — heartbeat 4h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | pull_recent_telemetry | T0 | TLM | — | — |
| 2 | classify_or_score | T1 | — | — | — |
| 3 | synthesize_insight | T2 | — | — | — |
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
| 1 | run_inference_and_connector_health_checks | T0 | TLM | — | supabase |
| 2 | summarize_if_anomaly | T1 | — | — | claude-code |
| 3 | emit_tlm_to_coo | T0 | TLM | — | — |

_Escalations:_
- `inference_error_rate_>2pct_5m` → `coo`
- `customer_facing_outage_detected` → `ceo.orchestrator`

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

### Dry-run gates (12)

- `cfo.capital.enforce_new_budgets`
- `cfo.econ.enforce_new_budgets`
- `cpo.build.publish_or_ship`
- `cpo.growth.brand_voice_gate`
- `cpo.growth.publish_to_sales_enablement_library`
- `cpo.roadmap.publish_or_ship`
- `cro.close.discount_governance_check`
- `cro.close.send_proposal_and_contract`
- `cro.demo.execute_demo_with_live_redline`
- `cro.expansion.execute_expansion_outreach`
- `cro.outbound.quality_gate_high_value_accounts`
- `cro.outbound.send_outbound_messages`

## Finalize · strategy review

### Monte Carlo winner
- **Strategy:** Runway-first _(CAPITAL_EFFICIENT)_
- _Preserve capital while validating product-market fit_
- **Mode:** `growth`
- Projected 30-cycle MRR growth: **1105%** · confidence: moderate (sharpe 0.36).

**Rationale:**
> CAPITAL_EFFICIENT wins: sharpe 0.36 (next RETENTION_FIRST at 0.21, 71% lead). Mean MRR growth 1105.0%, p(auto-catalytic) 97%, p(ruin) 0%.

### Imprint review

> Lexworth operates an AI-powered contract review tool for mid-market legal teams at manufacturers, with pricing between $2k and $5k per seat per month. The company has eight paying customers generating $15k MRR and is live in the 10k–100k MRR band. Growth comes from an outbound mid-market motion: LinkedIn outbound and cold email, targeting in-house counsel at manufacturing firms.
>
> The swarm runs 29 of 33 agents active, with four parked and none disabled. All four parked agents sit in the CMO branch: cmo.demand, cmo.content, cmo.brand, and cmo.advocacy. That aligns with the outbound posture — demand generation, content, brand, and advocacy are deferred while sales-led acquisition carries the load. Required connectors are claude-code, github, slack, and supabase; mixpanel is suggested but not required. Board comms route through Slack as a digest with urgent items escalated by phone. Claude Code runs on the Max 20x plan, verified.
>
> The Monte Carlo winner is CAPITAL_EFFICIENT. Over 30 cycles, mean MRR growth projects to 1105%, with a 97% probability of reaching auto-catalytic state and a 0% probability of ruin. Cycles-to-critical sits at 16.48, so the strategy expects Lexworth to cross the critical threshold inside roughly 16 to 17 operating cycles. The Sharpe of 0.36 is modest — returns are strong in expectation but the variance is meaningful, which is consistent with a capital-efficient path that does not force the pace through spend.
>
> The next 14 days run as a dry-run window starting 2026-05-06. Twelve tasks across the swarm are gated dry — they will produce proposed writes, drafts, and planned actions rather than executing against live systems. Before the window closes, the operator needs to review and approve those 12 held tasks so the swarm can begin writing to github, slack, and supabase under the CAPITAL_EFFICIENT plan. Connector verification for claude-code, github, slack, and supabase should be confirmed in the same window; mixpanel remains optional.

### Dry-run window
- Dry-run on: **true** · expires **2026-05-06T13:55:30.121Z**
- Manifest hash: `sha256:36ecc1c79ef2bc5d7e4a33a6ccedafcf743a522845975c134fcf9a0e03a7af91`

## Run metadata

| Phase | Elapsed (ms) |
|---|---:|
| pillar_1_ms | 1 |
| pillar_2_ms | 1 |
| pillar_3_5_ms | 1 |
| phase_2_ms | 10434 |
| phase_3_ms | 32396 |
| phase_4_ms | 76280 |
| finalize_ms | 14695 |
| **Total T2 calls** | **4** |

