# Variant report · vm07-open-source-devtool

*Pipeline mode:* **LIVE T2**
*Fixture description:* Validation matrix F7 · Open-source devtool with paid tier. Expected: GitHub required, content+community agents active, PLG+community unique pattern.

## Operator inputs (Pillars 1–5)

- **Company:** Migroscope · `https://github.com/migroscope/migroscope`
- **Claude plan:** max_20x
- **Stage:** live_paying_customers · $10k–$100k MRR
- **Lead sources:** content_seo, product_led_viral
- **Sales motion:** self_serve_plg
- **Board comms:** slack · digest_plus_urgent_phone

## Phase 1 · Pillar 1 enrichment

- **Enrichment status:** `enriched`
- **Industry hint:** dev_tools
- **Business model:** open_core
- **Has product:** yes
- **Ideal customer profile:** unspecified
- **Revenue model:** open_core
- **Competitive position:** emerging
- **Primary acquisition channel:** community-led
- **Product maturity signal:** ga
- **Tone signal:** technical
- **Primary friction hypothesis:** friction point not clearly specified — infer from GTM stage
- **Differentiator hypothesis:** Open-source CLI tool for database migrations

**Company context:**
> Open-source CLI tool for database migrations. Free for individuals, $49/dev/mo for teams with cloud sync and access control. 12k GitHub stars, 180 paying teams, $42k MRR. Community-led growth via GitHub and Twitter.

## Phase 2 · Connector manifest

*Source: T2 · onboarding/phase-2*

| Bucket | Count | Connectors |
|---|---:|---|
| Required | 5 | `claude-code`, `supabase`, `slack`, `mixpanel`, `github` |
| Suggested | 1 | `posthog` |
| Deferred | 0 | — |
| Blocked on approval | 1 | `supabase` |

### Required — details

| ID | Priority | Status | Dry-run | Rationale |
|---|---|---|---|---|
| Claude Code (inference) | P-1 | configured | — | Inference bootstrap for Migroscope's Omega instance — verified in Pillar 2 on max_20x plan. |
| Supabase (data + auth) | P0 | pending_credential | yes | Migroscope at $42k MRR — Supabase is the source of truth for team seats, MRR, and NRR that cfo/cdo read. |
| Slack (Board notifications) | P0 | pending_credential | no | Pillar 5 chose Slack with digest+urgent-phone routing for CEO notifications from the Board. |
| Mixpanel (product analytics) | P0 | pending_decision | — | Content-led PLG motion — cdo.attribute must join GitHub/Twitter inbound to CLI activation cohorts. |
| GitHub (code + ship events) | P-1 | pending_credential | — | 12k-star OSS CLI — GitHub is Migroscope's top-of-funnel and product surface; cpo.build + cdo.signal track both. |

### Suggested — details

| ID | Priority | Status | Rationale |
|---|---|---|---|
| PostHog (self-hosted product analytics) | P1 | pending_decision | CLI telemetry for the open-source binary — pairs with GitHub stars to resolve adoption vs. active-usage gap. |

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
| Customer insight & activation | 20% |
| Pipeline & conversion | 22% |
| Retention & expansion | 17% |
| Efficiency & runway | 17% |
| Positioning & narrative | 24% |

### Active agents (29)

| Agent | Department | Level | S+ | Skill overlay |
|---|---|---|:-:|---|
| `ceo.orchestrator` | ceo | L·II |  | Migroscope is a GA open-core dev-tools CLI at $10k-100k MRR on content-led PLG — orchestrate toward activation and community compounding, not enterprise motion |
| `cdo` | data | L·III |  | Migroscope data stack: Supabase + Mixpanel + GitHub — unify CLI telemetry, repo signal, and product analytics into one funnel view |
| `cdo.attribute` | data | L·IV |  | Migroscope attribution under content/PLG: map SEO content → GitHub discovery → CLI install → paid conversion; no ad channels to attribute |
| `cdo.infer` | data | L·IV | ✓ | Migroscope inference: predict OSS-to-paid conversion and churn risk from CLI usage patterns and GitHub org signals |
| `cdo.signal` | data | L·IV | ✓ | Migroscope signal: fuse GitHub repo events, Mixpanel product events, and Slack community signal into one activation/retention view |
| `cdo.telemetry` | data | L·IV |  | Migroscope CLI telemetry via Mixpanel (PostHog suggested) — ensure opt-in telemetry respects OSS user privacy norms |
| `cfo` | finance | L·III |  | Migroscope at $10k-100k MRR open-core — watch OSS-to-paid conversion economics and infra cost per active CLI user |
| `cfo.capital` | finance | L·IV |  | Migroscope at $10k-100k MRR emerging open-core — capital planning for runway through next ARR inflection, not growth-stage burn |
| `cfo.econ` | finance | L·IV |  | Migroscope unit economics: CAC is near-zero content/community — focus on infra COGS per CLI user and paid-tier gross margin |
| `cfo.forecast` | finance | L·IV |  | Migroscope forecast: self-serve PLG MRR is bottoms-up from Mixpanel signups × OSS-to-paid conversion — no sales-pipeline input |
| `cfo.treasury` | finance | L·IV |  | — |
| `cmo` | marketing | L·III |  | Migroscope GTM is content_seo + product_led_viral — treat docs, SEO, and GitHub surface as the primary marketing org |
| `cmo.advocacy` | marketing | L·IV |  | Migroscope open-core advocacy: GitHub stars, contributor growth, and Slack community engagement are the KPIs — not traditional referrals |
| `cmo.content` | marketing | L·IV | ✓ | Content is Migroscope's primary demand driver under content-led PLG — technical tone, migration deep-dives, and SEO for DB-ops queries |
| `cmo.demand` | marketing | L·IV | ✓ | Migroscope has no ad-platform connector — ad-bidding workflows disabled; demand gen runs through content/SEO and GitHub discovery |
| `coo` | ops | L·III |  | Migroscope ops: keep Claude Code, Supabase, Slack, Mixpanel, GitHub connectors healthy — PostHog is suggested, not yet wired |
| `coo.connector` | ops | L·IV |  | Migroscope connectors required: claude-code, supabase, slack, mixpanel, github; posthog suggested — surface gaps before swarm cycles block |
| `coo.dashboard` | ops | L·IV |  | Migroscope dashboard audience is a technical operator — surface CLI activation, GitHub stars, MRR, and migration success rate prominently |
| `coo.health` | ops | L·IV |  | Migroscope health: CLI error rates and migration success rate are the load-bearing health signals, not web uptime |
| `coo.memory` | ops | L·IV |  | — |
| `coo.observability` | ops | L·IV |  | Migroscope observability: Mixpanel for product, GitHub for repo, Slack for community — single pane across these three is the win |
| `coo.scheduler` | ops | L·IV |  | — |
| `cpo` | product | L·III |  | Migroscope product strategy: open-core CLI for DB migrations — protect OSS trust while shaping the paid tier boundary |
| `cpo.build` | product | L·IV | ✓ | Migroscope is a dev-tools CLI — code velocity IS the product; release cadence on GitHub gates activation and community trust |
| `cpo.growth` | product | L·IV | ✓ | Migroscope activation loops dominate — first-successful-migration and team-invite are the PLG wedges to instrument in Mixpanel |
| `cpo.qa` | product | L·IV |  | Migroscope QA: CLI regressions break customer migrations in prod — prioritize migration-safety tests over surface polish |
| `cpo.roadmap` | product | L·IV |  | Migroscope roadmap: balance OSS community asks (GitHub issues) against paid-tier differentiation at $10k-100k MRR |
| `cro` | revenue | L·III |  | Migroscope revenue is self-serve PLG at $10k-100k MRR — revenue ops optimize conversion + expansion, not pipeline |
| `cro.expansion` | revenue | L·IV | ✓ | Migroscope expansion under self-serve PLG: seat growth and team/org upgrades inside existing paying accounts — watch Mixpanel cohort retention |

### Parked (4) — not needed yet

| Agent | Unpark condition |
|---|---|
| `cmo.brand` | Stage reaches 100k_1m_mrr (positioning becomes load-bearing) |
| `cro.close` | Sales motion becomes assisted_demo or high_touch_enterprise |
| `cro.demo` | Sales motion becomes assisted_demo or high_touch_enterprise |
| `cro.outbound` | Outbound sales motion adopted (gtm_profile_enum starts with OUTBOUND_) |

### Spawn eligibility (S+)

- **`cpo.build`** — Migroscope is a dev-tools CLI — release cadence directly gates activation; spawn volume justified early
- **`cpo.growth`** — PLG activation loops are the primary lever at $10k-100k MRR — first-run and team-invite experiments need parallel spawns
- **`cmo.content`** — Content is the primary demand driver under content-led PLG — topic research, drafts, and SEO iterations justify sustained spawn queue
- **`cmo.advocacy`** — Open-core community motion — GitHub issue triage, contributor nurture, and Slack engagement generate continuous spawnable work
- **`cro.expansion`** — Self-serve PLG expansion into existing paying accounts is the main revenue lever — sustained account-level experiments
- **`cdo.signal`** — Unifying GitHub + Mixpanel + Slack signal is high-volume work in the first 30 cycles

## Phase 4 · Workflow manifest

*Source: T2 · onboarding/phase-4*

- Agent workflows: 29
- Bundle workflows: 5
- Dry-run gates: **9**
- T2 patches applied: **12**

### T2 patches — per-agent attribution

| Agent | Changed | Pillar signal | Rationale |
|---|---|---|---|
| `cmo.content` | on_fire | `pillar_1.gtm=CONTENT_LED_PLG; pillar_2.primary_acquisition=community-led; pillar_5.differentiator=open-source CLI for da` | Migroscope is community-led and CONTENT_LED_PLG around an open-source CLI, so cmo.content must pull developer-facing topics from GitHub issues/discussions and route drafts through a technical-tone gate before publishing. |
| `cmo.demand` | on_fire, escalation | `pillar_2.primary_acquisition=community-led; pillar_1.gtm=CONTENT_LED_PLG; pillar_3.revenue_model=open_core` | Migroscope's acquisition is community-led on an open-source CLI, not outbound SDR motion — demand should convert GitHub stargazers and CLI installers into PLG signups rather than pulling leads and sending outbound sequences. |
| `cmo.advocacy` | on_fire | `pillar_2.primary_acquisition=community-led; pillar_5.differentiator=open-source CLI; pillar_3.revenue_model=open_core` | As an open-source CLI with community-led acquisition, advocacy for Migroscope is driven by OSS contributors and power users, not closed-deal case studies — watch for high-signal community events instead of won deals. |
| `cro.expansion` | on_fire, escalation | `pillar_3.revenue_model=open_core; pillar_1.stage=live_paying_customers; pillar_5.differentiator=open-source CLI for data` | With live paying customers on an open_core model, cro.expansion should target OSS→paid conversion and paid-tier expansion driven by CLI usage limits, not generic pipeline work. |
| `cpo.qa` | on_fire | `pillar_4.product_maturity=ga; pillar_5.differentiator=open-source CLI for database migrations; pillar_1.stage=live_payin` | Migroscope is GA on an open-source CLI where quality regressions surface as GitHub issues and CLI error telemetry — QA should triage those streams, not generic product telemetry. |
| `cpo.build` | on_fire | `pillar_5.differentiator=open-source CLI for database migrations; pillar_4.product_maturity=ga` | For an open-source CLI tool, cpo.build ships by merging PRs and cutting releases on GitHub rather than generic publishing — the flow must gate on regression risk given database-migration blast radius. |
| `cpo.growth` | on_fire | `pillar_1.gtm=CONTENT_LED_PLG; pillar_5.differentiator=open-source CLI for database migrations; pillar_4.product_maturity` | PLG growth for an open-source CLI is driven by first-run activation and time-to-first-migration, so cpo.growth should ship onboarding/activation experiments rather than generic artifacts. |
| `cpo.roadmap` | on_fire | `pillar_2.primary_acquisition=community-led; pillar_5.differentiator=open-source CLI` | For an open-source project, roadmap is a public artifact that community trust depends on — cpo.roadmap should synthesize GitHub signals into a public roadmap rather than generic artifact drafting. |
| `cdo.signal` | on_fire | `pillar_2.primary_acquisition=community-led; pillar_1.stage=live_paying_customers; pillar_5.differentiator=open-source CL` | Migroscope's signal stack mixes OSS GitHub events, product telemetry, and paying-customer behavior — cdo.signal should merge these domain-specific streams rather than run a generic telemetry loop. |
| `cdo.attribute` | on_fire | `pillar_1.gtm=CONTENT_LED_PLG; pillar_2.primary_acquisition=community-led; pillar_3.revenue_model=open_core` | With community-led and content-led PLG, Migroscope's attribution must trace paid conversions back to OSS touchpoints (repo, docs, community) — standard marketing attribution misses the OSS surface. |
| `cdo.telemetry` | on_fire | `pillar_5.differentiator=open-source CLI for database migrations; pillar_2.primary_acquisition=community-led` | For a CLI tool, telemetry must handle opt-in/PII carefully and focus on command-level usage — generic telemetry loops risk leaking user data from an OSS product. |
| `cfo.econ` | on_fire | `pillar_3.revenue_model=open_core; pillar_1.stage=live_paying_customers` | Under an open_core model, unit economics hinge on OSS-serving cost vs paid-tier LTV — cfo.econ should allocate OSS infra/support cost against paid revenue rather than run a generic ROI loop. |

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
| 2 | draft_code_change_or_pr | T1 | — | — | claude-code |
| 3 | migration_safety_gate | T2 | — | — | github |
| 4 | merge_and_release | T2 | VAL | gated | github |
| 5 | emit_val_to_chief | T0 | VAL | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `cpo`

**`cpo.qa`** — heartbeat 4h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | pull_cli_errors_and_crash_telemetry | T0 | TLM | — | posthog |
| 2 | pull_github_bug_issues | T0 | TLM | — | github |
| 3 | classify_and_score_severity | T1 | — | — | — |
| 4 | synthesize_ga_stability_insight | T2 | — | — | — |
| 5 | emit_tlm_to_chief | T0 | TLM | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `cpo`

**`cpo.roadmap`** — heartbeat 1d

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | read_asn_from_chief | T0 | ASN | — | — |
| 2 | aggregate_community_demand | T0 | TLM | — | github |
| 3 | draft_public_roadmap_delta | T1 | — | — | claude-code |
| 4 | transparency_gate | T2 | — | — | — |
| 5 | publish_roadmap | T2 | VAL | gated | github |
| 6 | emit_val_to_chief | T0 | VAL | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `cpo`

**`cpo.growth`** — heartbeat 2h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | read_asn_from_chief | T0 | ASN | — | — |
| 2 | pull_activation_funnel | T0 | TLM | — | posthog |
| 3 | design_activation_experiment | T1 | — | — | claude-code |
| 4 | experiment_safety_gate | T2 | — | — | — |
| 5 | ship_experiment | T2 | VAL | gated | github |
| 6 | emit_val_to_chief | T0 | VAL | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `cpo`

**`cmo.demand`** — heartbeat 2h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | pull_plg_activation_signals | T0 | TLM | — | posthog |
| 2 | enrich_from_github | T0 | TLM | — | github |
| 3 | score_open_core_upgrade_fit | T1 | — | — | — |
| 4 | personalize_developer_nurture | T1 | — | — | claude-code |
| 5 | ship_nurture_via_community_surfaces | T2 | VAL | gated | slack |
| 6 | emit_val_to_chief | T0 | VAL | — | — |

_Escalations:_
- `spam_risk_flag or low_signal_cohort` → `cmo`
- `upgrade_conversion_spike` → `cro.expansion`

**`cmo.content`** — heartbeat 4h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | read_asn_from_chief | T0 | ASN | — | slack |
| 2 | mine_github_issues_and_discussions | T0 | TLM | — | github |
| 3 | draft_technical_artifact | T1 | — | — | claude-code |
| 4 | technical_tone_and_accuracy_gate | T2 | — | — | — |
| 5 | publish_to_channels | T2 | VAL | gated | github |
| 6 | emit_val_to_chief | T0 | VAL | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `cmo`

**`cmo.advocacy`** — heartbeat 6h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | watch_for_oss_advocacy_signals | T0 | TLM | — | github |
| 2 | watch_paid_champions | T0 | TLM | — | mixpanel |
| 3 | propose_advocacy_candidates | T1 | — | — | — |
| 4 | enroll_in_advocacy_pipeline | T2 | VAL | gated | slack |
| 5 | emit_val_to_cmo_content | T0 | VAL | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `cmo`

**`cro.expansion`** — heartbeat 6h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | read_usage_thresholds_and_paid_queue | T0 | TLM | — | mixpanel |
| 2 | prepare_tier_upgrade_brief | T2 | — | — | claude-code |
| 3 | execute_customer_action | T2 | VAL | gated | slack |
| 4 | log_outcome_tlm | T0 | TLM | — | supabase |

_Escalations:_
- `repeated_no_response_from_oss_user` → `cmo.demand`
- `expansion_blocker_is_product_gap` → `cpo`

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
| 1 | compute_oss_serving_cost | T0 | TLM | — | supabase |
| 2 | compute_paid_ltv_and_cac | T0 | TLM | — | mixpanel |
| 3 | compute_open_core_unit_econ | T0 | TLM | — | — |
| 4 | detect_drift | T0 | — | — | — |
| 5 | narrate_diff_for_board | T2 | — | — | — |
| 6 | enforce_new_budgets | T0 | CON | gated | slack |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `cfo`
- `burn_multiple_gt_2_5 || runway_lt_12mo` → `ceo.orchestrator`

**`cdo.signal`** — heartbeat 1h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | pull_multi_source_signals | T0 | TLM | — | posthog |
| 2 | classify_leading_indicators | T1 | — | — | — |
| 3 | synthesize_flywheel_insight | T2 | — | — | — |
| 4 | emit_tlm_to_chief | T0 | TLM | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `cdo`

**`cdo.attribute`** — heartbeat 4h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | pull_conversion_and_touchpoint_data | T0 | TLM | — | mixpanel |
| 2 | attribute_oss_to_paid | T1 | — | — | — |
| 3 | synthesize_channel_effectiveness | T2 | — | — | — |
| 4 | emit_tlm_to_chief | T0 | TLM | — | — |

_Escalations:_
- `unable_to_complete || kpi_drift_detected` → `cdo`

**`cdo.telemetry`** — heartbeat 2h

| # | Task | Tier | Flow | Dry-run | Connector |
|---:|---|---|---|:-:|---|
| 1 | pull_cli_command_telemetry | T0 | TLM | — | posthog |
| 2 | validate_opt_in_and_scrub | T0 | CON | — | — |
| 3 | classify_usage_patterns | T1 | — | — | — |
| 4 | synthesize_usage_insight | T2 | — | — | — |
| 5 | emit_tlm_to_chief | T0 | TLM | — | — |

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

### Dry-run gates (9)

- `cfo.capital.enforce_new_budgets`
- `cfo.econ.enforce_new_budgets`
- `cmo.advocacy.enroll_in_advocacy_pipeline`
- `cmo.content.publish_to_channels`
- `cmo.demand.ship_nurture_via_community_surfaces`
- `cpo.build.merge_and_release`
- `cpo.growth.ship_experiment`
- `cpo.roadmap.publish_roadmap`
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

> Migroscope operates an open-source CLI for database migrations with a dual model: free for individuals and $49 per developer per month for teams that need cloud sync and access control. The project has 12k GitHub stars, 180 paying teams, and $42k MRR, placing it in the live-paying-customers band within the $10k–$100k MRR range. Growth is CONTENT_LED_PLG, pulled through GitHub and Twitter rather than pushed through sales motion.
>
> The swarm is running 29 of 33 agents, with 4 parked and none disabled. The parked set is cmo.brand, cro.outbound, cro.demo, and cro.close — consistent with a community-led posture where outbound prospecting, demos, and closing motions are not load-bearing, and brand work is deferred while the product-led loop carries acquisition. Required connectors are claude-code, supabase, slack, mixpanel, and github, with posthog suggested as an addition. Board communications route through Slack as a regular digest, with urgent items escalated to phone.
>
> The Monte Carlo winner is CAPITAL_EFFICIENT. Across 30 cycles it projects 1105% mean MRR growth with a 97% probability of becoming auto-catalytic and a 0% probability of ruin, reaching criticality in roughly 16.5 cycles. Sharpe is 0.36, which reads as modest risk-adjusted return — the expected path is strong on absolute growth and ruin-safety, but variance across runs is material, so the winning strategy is earning its edge through survivability and compounding rather than through smooth execution.
>
> The dry-run window is 14 days starting 2026-05-06, during which 9 tasks across the swarm are held in a gated state. No writes go live from those tasks until the operator reviews and approves each one. Before the window closes, the 9 gated tasks need sign-off, the five required connectors need to be verified live, and posthog should be decided on or deferred. After approval, the held tasks release into normal execution and the swarm moves from observation into active operation on the CAPITAL_EFFICIENT strategy.

### Dry-run window
- Dry-run on: **true** · expires **2026-05-06T14:06:19.040Z**
- Manifest hash: `sha256:381a67e941f9fd7d6db96e105699b65478576e428007a79ffc31b26bb0c0cf2e`

## Run metadata

| Phase | Elapsed (ms) |
|---|---:|
| pillar_1_ms | 1 |
| pillar_2_ms | 0 |
| pillar_3_5_ms | 2 |
| phase_2_ms | 10463 |
| phase_3_ms | 41595 |
| phase_4_ms | 100420 |
| finalize_ms | 14920 |
| **Total T2 calls** | **4** |

