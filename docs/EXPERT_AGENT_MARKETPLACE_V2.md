# Expert Agent Marketplace v2 — Plan

Date: 2026-05-13. Status: planning. Replaces ad-hoc "should we add X agent?"
conversations with a prioritized, evidence-backed roadmap.

## What's in the catalog today (v1)

| id | tier | daily cap | purpose | hire count |
|---|---|---|---|---|
| `optimizer-v1` | founder | 40K | Board nudges driven by KPI snapshots + open issue titles | 1 |
| `alignment-v1` | growth | 140K | Drift correction vs Monte Carlo target curve | 1 |
| `error-handler-v1` | growth | 140K | Failed-run cluster triage + recovery comments | 1 |
| `concierge-v1` | custom | 420K | Full-access human-in-the-loop + escalation | 1 |

All 4 have working F.5 worker scripts, Ed25519 signing pinned, sealed-box
encrypted injection pipeline verified end-to-end with Claude Max OAuth.

## What's missing — gap analysis

Pillar 4 captures `lead_sources[]` and `sales_motion`. Pillar 5 captures
`comm_channel`. None of the v1 agents are tied to those signals — they're all
generic "look at KPIs and nudge." A real marketplace gives the customer a
catalog of agents whose data scope matches the workflows they actually run.

Pillar response enums we can pivot off:

- `LeadSource`: `inbound_ads_meta_google | outbound_cold | referral_word_of_mouth | content_seo | product_led_viral | partnerships | events | none_yet`
- `SalesMotion`: `self_serve_plg | assisted_demo | high_touch_enterprise | none_yet`
- `CommChannel`: `telegram | slack | sms | email_only`

Industry signals from Pillar 1 + Pillar 3 stage map to specific agent demand
(fintech → compliance, prototype → founder coaching, live-paying → investor
updates).

## Prioritization rubric

Each candidate scored 1-5 on three axes:

1. **Coverage** — how many `LeadSource` / `SalesMotion` / `CommChannel`
   combinations is this agent useful for?
2. **T2 cost displacement** — if a customer would otherwise run this prompt
   manually through chat, how much Pool A / Pool B inference does it save
   the operator per week? (estimated tokens)
3. **Authority bounds** — how easy is it to scope this agent's
   `data_scope[]` + `output_types[]` cleanly via the Liaison? Lower
   complexity = lower risk = ship sooner.

Ship order = (coverage × cost_displacement) ÷ authority_complexity.

## v2 candidates (prioritized)

### Tier 1 — ship in the next sprint

#### 1. `demand-gen-v1` — Content Cadence Agent  &nbsp; [tier: growth, score 25]
- **Triggers when**: `lead_sources` includes `content_seo` or `product_led_viral`
- **Data scope**: `kpi_snapshots` (organic_traffic, signups_via_content),
  `content_calendar`, `comments` on content-cadence issues
- **Output types**: `issue_comment`, `new_issue` (always tagged with
  `target_kpi=organic_traffic` or `content_to_signup_rate`)
- **Daily token cap**: 140K
- **Why now**: every content-led customer is asking "what should I publish
  next?" — this displaces 4-6 manual chat sessions per week.

#### 2. `outbound-cadence-v1` — Outbound Sequence Agent  &nbsp; [tier: growth, score 24]
- **Triggers when**: `lead_sources` includes `outbound_cold` AND
  `sales_motion` ∈ {`assisted_demo`, `high_touch_enterprise`}
- **Data scope**: `kpi_snapshots` (outbound_sends, reply_rate, mqls),
  `sequence_step_metrics`, `comments` on outbound issues
- **Output types**: `issue_comment` (sequence A/B suggestions), `new_issue`
  (when reply_rate drops a threshold)
- **Daily token cap**: 140K
- **Why now**: B2B SaaS customers have nowhere to send sequence-iteration
  questions — currently a heavy Pool B drag.

#### 3. `concierge-handoff-v1` — Assisted-Demo Concierge  &nbsp; [tier: growth, score 22]
- **Triggers when**: `sales_motion=assisted_demo` AND
  `comm_channel ∈ {telegram, slack}`
- **Data scope**: `kpi_snapshots` (demo_booked → demo_completed →
  closed_won funnel), `pipeline_signals`, `chat_transcripts` (redacted)
- **Output types**: `issue_comment` (nudges on stuck demos), `new_issue`
  (escalations for cold-handoff demos)
- **Distinct from `concierge-v1`**: scoped to demo motion specifically, not
  full-access. Less custom-tier, more growth-tier appropriate.
- **Daily token cap**: 100K
- **Why now**: the most-requested "I want a salesperson agent" pattern from
  the onboarding interviews.

### Tier 2 — ship next month

#### 4. `founder-coach-v1` — Pre-PMF Coach  &nbsp; [tier: founder, score 19]
- **Triggers when**: Pillar 3 stage = `prototype` or `pre-product` AND
  `MRR < $5K`
- **Data scope**: `kpi_snapshots`, `pillar_responses.goal`,
  `mc_report.json` (Monte Carlo baseline)
- **Output types**: `issue_comment` only (no new_issue — keeps the noise
  bounded for early-stage operators)
- **Daily token cap**: 40K
- **Why**: covers the 30% of customers in pre-PMF where alignment-v1 and
  optimizer-v1 are too aggressive ("hit your MRR target!" is dispiriting
  when you're at $0).

#### 5. `investor-update-v1` — Monthly Investor Composer  &nbsp; [tier: growth, score 18]
- **Triggers when**: customer has connected `linkedin` or
  `gmail`/`telegram` AND has > 30 days of KPI snapshots
- **Data scope**: `kpi_snapshots` (last 90d), `goal`, `issues_closed`
  (last 30d)
- **Output types**: `new_issue` only — drafts a monthly update doc as an
  issue body, customer reviews and sends manually
- **Daily token cap**: 80K (one big batch per month)
- **Why**: high-leverage drafting workload, very token-heavy if done by
  customer through hub T2.

#### 6. `churn-prediction-v1` — Pre-Cancel Signal Agent  &nbsp; [tier: growth, score 17]
- **Triggers when**: customer has a Stripe-connected subscription product
  AND ≥ 7 days of usage data
- **Data scope**: `usage_signals`, `payment_events`, `kpi_snapshots`
- **Output types**: `new_issue` flagging at-risk users with confidence + a
  recommended outreach script (not auto-sent — operator owns the message)
- **Daily token cap**: 100K
- **Why**: directly drives retention KPI; clear ROI story.

### Tier 3 — gated on legal / industry review

#### 7. `compliance-sweep-v1` — Fintech/Healthtech Watcher  &nbsp; [tier: custom, score 15]
- **Triggers when**: industry ∈ {fintech, healthtech, insurtech}
- **Data scope**: `agent_runs`, `comments`, `customer_communications`
  (read-only audit, NEVER content_modifying)
- **Output types**: `issue_comment` (compliance notes), `human_escalation`
- **Daily token cap**: 80K
- **Why custom-tier**: regulatory risk if the agent makes a wrong call —
  needs explicit operator agreement + WaveX legal sign-off per industry.

#### 8. `crm-hygiene-v1` — Dedupe + Enrich  &nbsp; [tier: growth, score 14]
- **Triggers when**: customer connects HubSpot OR Salesforce
- **Data scope**: `crm.contacts`, `crm.companies` (read-only — no writes
  in v1 to keep the trust story clean)
- **Output types**: `issue_comment` (dedupe candidates), `new_issue`
  (enrichment opportunities)
- **Daily token cap**: 100K
- **Why**: the most-requested "agent that touches my CRM" pattern, but
  write authority requires phase 2 work on Liaison scope expansion.

## Pricing implications

Current tiers: founder ($X), growth ($Y), custom ($Z). With 6-10 new
agents, the value-per-tier gap widens — growth tier becomes much more
attractive. Specifically:

| Tier | Today | After v2 |
|---|---|---|
| founder | 1 agent (optimizer) | 2 agents (optimizer + founder-coach) |
| growth | 3 agents | 7 agents — every common B2B lead-source covered |
| custom | 4 agents | 9-10 agents — adds compliance + CRM hygiene |

This justifies raising growth pricing without churn risk.

## Implementation sequence per agent

Each new catalog entry follows the existing F.4/F.5 contract:

1. **DB row** in `expert_agent_catalog` with `signing_public_key`
   (Ed25519) + `recipient_public_key` (X25519, sealed-box).
2. **Worker script** in `scripts/workers/worker-<agent-id>.mjs` —
   structurally identical to the 4 existing ones, swap the prompt path +
   `data_scope[]` extraction.
3. **Prompt template** at `docs/prompts/<agent-id>.md` with explicit
   "you may only emit one of: [...allowed output_types]" guardrails.
4. **Pricing page card** in `pricing` route — uses the existing
   `<AgentCard>` component with `scope_tags` + Processing Agreement gate.
5. **Liaison auto-hire rule** (optional) when the customer's pillar
   responses match the agent's trigger criteria — surfaces as a
   "recommended" badge on the pricing page.

Estimated time per agent: 4-6 hours from catalog row to live in production.
Total for 8 agents: ~2 sprint-weeks.

## What's NOT being added (and why)

- **A "write to customer's app" agent** — too much trust surface, leave to
  customer's own fleet agents (which Liaison-mediates per company).
- **A "code review" agent** — overlaps with Claude Code; not a value-add
  via the injection pipeline.
- **A "deploy on customer's behalf" agent** — security nightmare; the F.5
  pipeline is read+inject, never write to customer infra.

## Next steps (immediate)

1. **Seed `demand-gen-v1`** as the v2 pilot — highest score, simplest
   data_scope, no new connector requirements. Smoke against the QA test
   subscription on disk.
2. **Update pricing-page copy** to preview the marketplace (no live new
   cards yet — just "8 more agents coming this month" teaser).
3. **Operator agent (T5)** monitors marketplace adoption metrics
   (hire-count per catalog id per week) and feeds it back to this doc as
   a "validated vs. shelved" annotation column.
