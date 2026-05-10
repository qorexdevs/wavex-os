# Fixture Battery — 10 variants

Generated: 2026-05-10T02:09:04.159Z
Mode: **real T2 inference**

## Cross-fixture summary

| Tag | Industry shape | Required | Suggested | Active | Standby | Parked | Disabled |
|---|---|---|---|---|---|---|---|
| **acme** | B2B SaaS · workflow automation · $1k-5k/mo · assisted demo ·… | 5 | 5 | 32 | 0 | 2 | 0 |
| **pulse** | Pre-product · AI fitness coaching for solo trainers · idea_o… | 3 | 3 | 20 | 0 | 13 | 1 |
| **ricoma** | Hardware manufacturer · commercial embroidery machines · DTC… | 7 | 5 | 31 | 0 | 3 | 0 |
| **rho** | Two-sided marketplace · independent contractors connecting t… | 5 | 6 | 29 | 0 | 5 | 0 |
| **iris** | EdTech · K-12 reading curriculum · district sales · long ent… | 5 | 4 | 30 | 0 | 4 | 0 |
| **canopy** | DTC e-commerce · clean skincare brand · paid ads + influence… | 8 | 3 | 29 | 0 | 5 | 0 |
| **meridian** | B2B services · brand + product strategy consulting · retaine… | 5 | 5 | 32 | 0 | 2 | 0 |
| **ironside** | FinTech · embedded payments + reconciliation · regulated · e… | 5 | 5 | 31 | 0 | 3 | 0 |
| **vitalis** | HealthTech · clinician burnout AI scribe · HIPAA · health-sy… | 3 | 7 | 30 | 0 | 4 | 0 |
| **helix** | Open-source dev tool · CLI for vector data pipelines · commu… | 5 | 4 | 30 | 0 | 4 | 0 |

## Per-slot template selection across all fixtures

| Slot | acme | pulse | ricoma | rho | iris | canopy | meridian | ironside | vitalis | helix |
|---|---|---|---|---|---|---|---|---|---|---|
| `cdo` | ✓ cdo | ✓ cdo | ✓ cdo | ✓ cdo | ✓ cdo | ✓ cdo | ✓ cdo | ✓ cdo | ✓ cdo | ✓ cdo |
| `cdo.attribute` | ✓ support-analytics | ○ support-analytics | ✓ support-analytics | ✓ support-analytics | ✓ support-analytics | ✓ growth-experiment-designer | ✓ growth-experiment-designer | ✓ support-analytics | ✓ support-analytics | ✓ support-analytics |
| `cdo.infer` | ✓ ai-engineer | ✓ ai-engineer | ✓ ai-engineer | ✓ ai-engineer | ✓ prompt-engineer | ✓ image-prompt-engineer | ✓ prompt-engineer | ✓ prompt-engineer | ✓ prompt-engineer | ✓ ai-engineer |
| `cdo.signal` | ✓ ai-engineer | ✓ ai-engineer | ✓ ai-engineer | ✓ ai-engineer | ✓ prompt-engineer | ✓ data-engineer | ✓ prompt-engineer | ✓ mlops-engineer | ✓ prompt-engineer | ✓ ai-engineer |
| `cdo.telemetry` | ✓ support-analytics | ✓ support-analytics | ✓ support-analytics | ✓ support-analytics | ✓ support-analytics | ✓ data-engineer | ✓ analytics-reporter | ✓ data-engineer | ✓ support-analytics | ✓ support-analytics |
| `ceo.orchestrator` | ✓ ceo | ✓ ceo | ✓ ceo | ✓ ceo | ✓ ceo | ✓ ceo | ✓ ceo | ✓ ceo | ✓ ceo | ✓ ceo |
| `cfo` | ✓ cfo | ✓ cfo | ✓ cfo | ✓ cfo | ✓ cfo | ✓ cfo | ✓ cfo | ✓ cfo | ✓ cfo | ✓ cfo |
| `cfo.capital` | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst |
| `cfo.econ` | ✓ financial-analyst | ✗ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst |
| `cfo.forecast` | ✓ financial-analyst | ○ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst |
| `cfo.treasury` | ✓ bookkeeper | ○ bookkeeper | ✓ bookkeeper | ✓ bookkeeper | ✓ bookkeeper | ✓ bookkeeper | ✓ bookkeeper | ✓ bookkeeper | ✓ bookkeeper | ✓ bookkeeper |
| `cmo` | ✓ cmo | ✓ cmo | ✓ cmo | ✓ cmo | ✓ cmo | ✓ cmo | ✓ cmo | ✓ cmo | ✓ cmo | ✓ cmo |
| `cmo.advocacy` | ○ community-builder | ○ community-builder | ○ brand-guardian | ○ community-builder | ○ community-builder | ○ content-creator | ✓ brand-guardian | ✓ brand-guardian | ○ community-builder | ✓ community-builder |
| `cmo.brand` | ○ content-creator | ✓ ad-creative-strategist | ○ ad-creative-strategist | ○ ad-creative-strategist | ○ story-architect | ○ ad-creative-strategist | ○ brand-guardian | ○ brand-guardian | ○ story-architect | ○ content-creator |
| `cmo.content` | ✓ content-creator | ○ content-creator | ✓ story-architect | ✓ content-creator | ○ story-architect | ✓ content-creator | ✓ story-architect | ○ story-architect | ○ story-architect | ✓ content-creator |
| `cmo.demand` | ✓ growth-hacker | ○ community-builder | ✓ growth-hacker | ✓ growth-hacker | ○ community-builder | ✓ growth-hacker | ✓ growth-hacker | ○ community-builder | ○ community-builder | ✓ community-builder |
| `coo` | ✓ coo | ✓ coo | ✓ coo | ✓ coo | ✓ coo | ✓ coo | ✓ coo | ✓ coo | ✓ coo | ✓ coo |
| `coo.connector` | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration |
| `coo.credentials` | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration |
| `coo.dashboard` | ✓ frontend-developer | ○ frontend-developer | ✓ analytics-reporter | ✓ analytics-reporter | ✓ frontend-developer | ✓ analytics-reporter | ✓ analytics-reporter | ✓ frontend-developer | ✓ frontend-developer | ✓ frontend-developer |
| `coo.health` | ✓ recovery-engineer | ✓ recovery-engineer | ✓ recovery-engineer | ✓ recovery-engineer | ✓ recovery-engineer | ✓ recovery-engineer | ✓ incident-responder | ✓ incident-responder | ✓ incident-responder | ✓ recovery-engineer |
| `coo.memory` | ✓ devops-engineer | ✓ devops-engineer | ✓ feedback-synthesizer | ✓ devops-engineer | ✓ devops-engineer | ✓ executive-summary-generator | ✓ executive-summary-generator | ✓ devops-engineer | ✓ devops-engineer | ✓ devops-engineer |
| `coo.observability` | ✓ devops-engineer | ✓ devops-engineer | ✓ analytics-reporter | ✓ devops-engineer | ✓ devops-engineer | ✓ analytics-reporter | ✓ analytics-reporter | ✓ devops-engineer | ✓ devops-engineer | ✓ devops-engineer |
| `coo.scheduler` | ✓ devops-engineer | ✓ devops-engineer | ✓ devops-engineer | ✓ devops-engineer | ✓ experiment-tracker | ✓ devops-engineer | ✓ experiment-tracker | ✓ experiment-tracker | ✓ experiment-tracker | ✓ devops-engineer |
| `cpo` | ✓ cpo | ✓ cpo | ✓ cpo | ✓ cpo | ✓ cpo | ✓ cpo | ✓ cpo | ✓ cpo | ✓ cpo | ✓ cpo |
| `cpo.build` | ✓ backend-architect | ✓ backend-architect | ✓ ai-engineer | ✓ ai-engineer | ✓ frontend-developer | ✓ backend-architect | ✓ backend-architect | ✓ backend-architect | ✓ backend-architect | ✓ backend-architect |
| `cpo.growth` | ✓ growth-hacker | ○ growth-hacker | ✓ growth-hacker | ✓ growth-hacker | ✓ experiment-tracker | ✓ growth-hacker | ✓ experiment-tracker | ✓ experiment-tracker | ✓ experiment-tracker | ✓ growth-hacker |
| `cpo.qa` | ✓ api-tester | ○ api-tester | ✓ accessibility-auditor | ✓ api-tester | ✓ accessibility-auditor | ✓ performance-benchmarker | ✓ accessibility-auditor | ✓ api-tester | ✓ evidence-collector | ✓ api-tester |
| `cpo.roadmap` | ✓ product-manager | ✓ product-manager | ✓ product-manager | ✓ product-manager | ✓ product-manager | ✓ ux-architect | ✓ ux-architect | ✓ ux-architect | ✓ product-manager | ✓ product-manager |
| `cro` | ✓ cro | ✓ cro | ✓ cro | ✓ cro | ✓ cro | ✓ cro | ✓ cro | ✓ cro | ✓ cro | ✓ cro |
| `cro.close` | ✓ deal-strategist | ○ sales-coach | ✓ sales-coach | ○ sales-coach | ✓ sales-coach | ○ sales-coach | ✓ sales-coach | ✓ sales-coach | ✓ sales-coach | ○ sales-coach |
| `cro.demo` | ✓ sales-engineer | ○ sales-engineer | ✓ sales-engineer | ○ sales-engineer | ✓ sales-engineer | ○ sales-engineer | ✓ sales-engineer | ✓ sales-engineer | ✓ solutions-architect | ○ sales-engineer |
| `cro.expansion` | ✓ account-strategist | ○ sales-coach | ✓ sales-coach | ✓ sales-coach | ✓ sales-coach | ✓ sales-coach | ✓ sales-coach | ✓ sales-coach | ✓ sales-coach | ✓ sales-coach |
| `cro.outbound` | ✓ account-strategist | ○ sales-coach | ○ sales-coach | ○ sales-coach | ✓ sales-coach | ○ sales-coach | ○ sales-coach | ✓ sales-coach | ✓ outbound-prospector | ○ sales-coach |

---
## `acme` — B2B SaaS · workflow automation · $1k-5k/mo · assisted demo · mid-market

**Pillar inputs**
- Pillar 1: Acme Workflows · https://acme-workflows.example
  > Acme is a B2B SaaS workflow automation platform sold to mid-market ops teams. Pricing $1k-5k/mo, assisted demos, ~200 customers, growing 20% MoM.
- Pillar 3: product_state=live_paying_customers · stage=10k_100k_mrr
- Pillar 4: lead_sources=[outbound_cold, content_seo] · sales_motion=assisted_demo · close_channel=mostly_phone_video
- Pillar 5: comm_channel=telegram · urgency=all_to_one_channel

**Connectors**
- Required (5): claude-code, supabase, github, telegram, mixpanel
- Suggested (5): hubspot, calendly, stripe, gmail, linear
- Deferred (3): linkedin-sales-nav, segment, google_calendar

**Swarm topology**
- Active: 32 · Standby: 0 · Parked: 2 · Disabled: 0
- Total slots: 34

**Activated fleet (34 rows in DB)**

| Slot | Display | Template | Status | Reports to |
|---|---|---|---|---|
| `cdo` | Cdo | `cdo` | ✓ ready | ceo.orchestrator |
| `cdo.attribute` | Support Analytics | `support-analytics` | ✓ ready | cdo |
| `cdo.infer` | Ai Engineer | `ai-engineer` | ✓ ready | cdo |
| `cdo.signal` | Ai Engineer | `ai-engineer` | ✓ ready | cdo |
| `cdo.telemetry` | Support Analytics | `support-analytics` | ✓ ready | cdo |
| `ceo.orchestrator` | Ceo | `ceo` | ✓ ready | — |
| `cfo` | Cfo | `cfo` | ✓ ready | ceo.orchestrator |
| `cfo.capital` | Financial Analyst | `financial-analyst` | ✓ ready | cfo |
| `cfo.econ` | Financial Analyst | `financial-analyst` | ✓ ready | cfo |
| `cfo.forecast` | Financial Analyst | `financial-analyst` | ✓ ready | cfo |
| `cfo.treasury` | Bookkeeper | `bookkeeper` | ✓ ready | cfo |
| `cmo` | Cmo | `cmo` | ✓ ready | ceo.orchestrator |
| `cmo.advocacy` | Community Builder | `community-builder` | ○ pending | cmo |
| `cmo.brand` | Content Creator | `content-creator` | ○ pending | cmo |
| `cmo.content` | Content Creator | `content-creator` | ✓ ready | cmo |
| `cmo.demand` | Growth Hacker | `growth-hacker` | ✓ ready | cmo |
| `coo` | Coo | `coo` | ✓ ready | ceo.orchestrator |
| `coo.connector` | Composio Integration | `composio-integration` | ✓ ready | coo |
| `coo.credentials` | Composio Integration | `composio-integration` | ✓ ready | coo |
| `coo.dashboard` | Frontend Developer | `frontend-developer` | ✓ ready | coo |
| `coo.health` | Recovery Engineer | `recovery-engineer` | ✓ ready | coo |
| `coo.memory` | Devops Engineer | `devops-engineer` | ✓ ready | coo |
| `coo.observability` | Devops Engineer | `devops-engineer` | ✓ ready | coo |
| `coo.scheduler` | Devops Engineer | `devops-engineer` | ✓ ready | coo |
| `cpo` | Cpo | `cpo` | ✓ ready | ceo.orchestrator |
| `cpo.build` | Backend Architect | `backend-architect` | ✓ ready | cpo |
| `cpo.growth` | Growth Hacker | `growth-hacker` | ✓ ready | cpo |
| `cpo.qa` | Api Tester | `api-tester` | ✓ ready | cpo |
| `cpo.roadmap` | Product Manager | `product-manager` | ✓ ready | cpo |
| `cro` | Cro | `cro` | ✓ ready | ceo.orchestrator |
| `cro.close` | Deal Strategist | `deal-strategist` | ✓ ready | cro |
| `cro.demo` | Sales Engineer | `sales-engineer` | ✓ ready | cro |
| `cro.expansion` | Account Strategist | `account-strategist` | ✓ ready | cro |
| `cro.outbound` | Account Strategist | `account-strategist` | ✓ ready | cro |

Manifest sha256: `sha256:f3f35df00842b54f03df973b505d5ce9ecad4df5b27117ccbf946e5e270af9a1` · finalize source: t2

---
## `pulse` — Pre-product · AI fitness coaching for solo trainers · idea_only · validating with interviews

**Pillar inputs**
- Pillar 1: Pulse · no product yet
  > Pulse is a pre-product idea — exploring AI-driven fitness coaching for solo trainers. No code shipped, no paying customers, validating with interviews.
- Pillar 3: product_state=idea_only · stage=pre_product
- Pillar 4: lead_sources=[none_yet] · sales_motion=none_yet · close_channel=—
- Pillar 5: comm_channel=telegram · urgency=—

**Connectors**
- Required (3): claude-code, github, telegram
- Suggested (3): supabase, calendly, notion
- Deferred (5): stripe, hubspot, mixpanel, posthog, sendgrid

**Swarm topology**
- Active: 20 · Standby: 0 · Parked: 13 · Disabled: 1
- Total slots: 34

**Activated fleet (34 rows in DB)**

| Slot | Display | Template | Status | Reports to |
|---|---|---|---|---|
| `cdo` | Cdo | `cdo` | ✓ ready | ceo.orchestrator |
| `cdo.attribute` | Support Analytics | `support-analytics` | ○ pending | cdo |
| `cdo.infer` | Ai Engineer | `ai-engineer` | ✓ ready | cdo |
| `cdo.signal` | Ai Engineer | `ai-engineer` | ✓ ready | cdo |
| `cdo.telemetry` | Support Analytics | `support-analytics` | ✓ ready | cdo |
| `ceo.orchestrator` | Ceo | `ceo` | ✓ ready | — |
| `cfo` | Cfo | `cfo` | ✓ ready | ceo.orchestrator |
| `cfo.capital` | Financial Analyst | `financial-analyst` | ✓ ready | cfo |
| `cfo.econ` | Financial Analyst | `financial-analyst` | ✗ failed | cfo |
| `cfo.forecast` | Financial Analyst | `financial-analyst` | ○ pending | cfo |
| `cfo.treasury` | Bookkeeper | `bookkeeper` | ○ pending | cfo |
| `cmo` | Cmo | `cmo` | ✓ ready | ceo.orchestrator |
| `cmo.advocacy` | Community Builder | `community-builder` | ○ pending | cmo |
| `cmo.brand` | Ad Creative Strategist | `ad-creative-strategist` | ✓ ready | cmo |
| `cmo.content` | Content Creator | `content-creator` | ○ pending | cmo |
| `cmo.demand` | Community Builder | `community-builder` | ○ pending | cmo |
| `coo` | Coo | `coo` | ✓ ready | ceo.orchestrator |
| `coo.connector` | Composio Integration | `composio-integration` | ✓ ready | coo |
| `coo.credentials` | Composio Integration | `composio-integration` | ✓ ready | coo |
| `coo.dashboard` | Frontend Developer | `frontend-developer` | ○ pending | coo |
| `coo.health` | Recovery Engineer | `recovery-engineer` | ✓ ready | coo |
| `coo.memory` | Devops Engineer | `devops-engineer` | ✓ ready | coo |
| `coo.observability` | Devops Engineer | `devops-engineer` | ✓ ready | coo |
| `coo.scheduler` | Devops Engineer | `devops-engineer` | ✓ ready | coo |
| `cpo` | Cpo | `cpo` | ✓ ready | ceo.orchestrator |
| `cpo.build` | Backend Architect | `backend-architect` | ✓ ready | cpo |
| `cpo.growth` | Growth Hacker | `growth-hacker` | ○ pending | cpo |
| `cpo.qa` | Api Tester | `api-tester` | ○ pending | cpo |
| `cpo.roadmap` | Product Manager | `product-manager` | ✓ ready | cpo |
| `cro` | Cro | `cro` | ✓ ready | ceo.orchestrator |
| `cro.close` | Sales Coach | `sales-coach` | ○ pending | cro |
| `cro.demo` | Sales Engineer | `sales-engineer` | ○ pending | cro |
| `cro.expansion` | Sales Coach | `sales-coach` | ○ pending | cro |
| `cro.outbound` | Sales Coach | `sales-coach` | ○ pending | cro |

Manifest sha256: `sha256:fa3dbfd4f6cda7baad578697b683dc465e9643857fa1695ea6ca901cc7d88325` · finalize source: t2

---
## `ricoma` — Hardware manufacturer · commercial embroidery machines · DTC + dealer · existing $1M+ ARR

**Pillar inputs**
- Pillar 1: Ricoma · https://ricoma.com
  > Ricoma manufactures and sells commercial embroidery machines (Chroma SaaS sidecar) to small custom-apparel businesses. Direct-to-consumer hardware sales with hardware financing. Multi-channel: dealer network + direct + ecom. ~$2M ARR.
- Pillar 3: product_state=live_paying_customers · stage=1m_5m_arr
- Pillar 4: lead_sources=[content_seo, inbound_ads_meta_google, events] · sales_motion=assisted_demo · close_channel=mostly_phone_video
- Pillar 5: comm_channel=telegram · urgency=digest_plus_urgent_phone

**Connectors**
- Required (7): claude-code, supabase, github, telegram, mixpanel, shopify, stripe
- Suggested (5): klaviyo, hubspot, meta-ads-api, google-ads-api, calendly
- Deferred (3): shipstation, intercom, sendgrid

**Swarm topology**
- Active: 31 · Standby: 0 · Parked: 3 · Disabled: 0
- Total slots: 34

**Activated fleet (34 rows in DB)**

| Slot | Display | Template | Status | Reports to |
|---|---|---|---|---|
| `cdo` | Cdo | `cdo` | ✓ ready | ceo.orchestrator |
| `cdo.attribute` | Support Analytics | `support-analytics` | ✓ ready | cdo |
| `cdo.infer` | Ai Engineer | `ai-engineer` | ✓ ready | cdo |
| `cdo.signal` | Ai Engineer | `ai-engineer` | ✓ ready | cdo |
| `cdo.telemetry` | Support Analytics | `support-analytics` | ✓ ready | cdo |
| `ceo.orchestrator` | Ceo | `ceo` | ✓ ready | — |
| `cfo` | Cfo | `cfo` | ✓ ready | ceo.orchestrator |
| `cfo.capital` | Financial Analyst | `financial-analyst` | ✓ ready | cfo |
| `cfo.econ` | Financial Analyst | `financial-analyst` | ✓ ready | cfo |
| `cfo.forecast` | Financial Analyst | `financial-analyst` | ✓ ready | cfo |
| `cfo.treasury` | Bookkeeper | `bookkeeper` | ✓ ready | cfo |
| `cmo` | Cmo | `cmo` | ✓ ready | ceo.orchestrator |
| `cmo.advocacy` | Brand Guardian | `brand-guardian` | ○ pending | cmo |
| `cmo.brand` | Ad Creative Strategist | `ad-creative-strategist` | ○ pending | cmo |
| `cmo.content` | Story Architect | `story-architect` | ✓ ready | cmo |
| `cmo.demand` | Growth Hacker | `growth-hacker` | ✓ ready | cmo |
| `coo` | Coo | `coo` | ✓ ready | ceo.orchestrator |
| `coo.connector` | Composio Integration | `composio-integration` | ✓ ready | coo |
| `coo.credentials` | Composio Integration | `composio-integration` | ✓ ready | coo |
| `coo.dashboard` | Analytics Reporter | `analytics-reporter` | ✓ ready | coo |
| `coo.health` | Recovery Engineer | `recovery-engineer` | ✓ ready | coo |
| `coo.memory` | Feedback Synthesizer | `feedback-synthesizer` | ✓ ready | coo |
| `coo.observability` | Analytics Reporter | `analytics-reporter` | ✓ ready | coo |
| `coo.scheduler` | Devops Engineer | `devops-engineer` | ✓ ready | coo |
| `cpo` | Cpo | `cpo` | ✓ ready | ceo.orchestrator |
| `cpo.build` | Ai Engineer | `ai-engineer` | ✓ ready | cpo |
| `cpo.growth` | Growth Hacker | `growth-hacker` | ✓ ready | cpo |
| `cpo.qa` | Accessibility Auditor | `accessibility-auditor` | ✓ ready | cpo |
| `cpo.roadmap` | Product Manager | `product-manager` | ✓ ready | cpo |
| `cro` | Cro | `cro` | ✓ ready | ceo.orchestrator |
| `cro.close` | Sales Coach | `sales-coach` | ✓ ready | cro |
| `cro.demo` | Sales Engineer | `sales-engineer` | ✓ ready | cro |
| `cro.expansion` | Sales Coach | `sales-coach` | ✓ ready | cro |
| `cro.outbound` | Sales Coach | `sales-coach` | ○ pending | cro |

Manifest sha256: `sha256:29b483968b85efc3fedefd0d1b0cacb10706fb99351b7136f3a7832c5dca2ae0` · finalize source: t2

---
## `rho` — Two-sided marketplace · independent contractors connecting to small businesses · early traction

**Pillar inputs**
- Pillar 1: Rho · https://rho-jobs.example
  > Rho is a two-sided marketplace connecting independent contractors (plumbers, electricians, HVAC) to small businesses needing recurring service. Take rate 12% on $200-2000 jobs. Currently in 3 metros, scaling to 10.
- Pillar 3: product_state=live_paying_customers · stage=100k_500k_arr
- Pillar 4: lead_sources=[inbound_ads_meta_google, outbound_cold, partnerships] · sales_motion=self_serve_plg · close_channel=mixed
- Pillar 5: comm_channel=slack · urgency=digest_plus_urgent_phone

**Connectors**
- Required (5): claude-code, supabase, github, slack, stripe-connect
- Suggested (6): meta-ads-api, google-ads-api, mixpanel, segment, twilio-sms, hubspot
- Deferred (3): shipstation, intercom, plaid

**Swarm topology**
- Active: 29 · Standby: 0 · Parked: 5 · Disabled: 0
- Total slots: 34

**Activated fleet (34 rows in DB)**

| Slot | Display | Template | Status | Reports to |
|---|---|---|---|---|
| `cdo` | Cdo | `cdo` | ✓ ready | ceo.orchestrator |
| `cdo.attribute` | Support Analytics | `support-analytics` | ✓ ready | cdo |
| `cdo.infer` | Ai Engineer | `ai-engineer` | ✓ ready | cdo |
| `cdo.signal` | Ai Engineer | `ai-engineer` | ✓ ready | cdo |
| `cdo.telemetry` | Support Analytics | `support-analytics` | ✓ ready | cdo |
| `ceo.orchestrator` | Ceo | `ceo` | ✓ ready | — |
| `cfo` | Cfo | `cfo` | ✓ ready | ceo.orchestrator |
| `cfo.capital` | Financial Analyst | `financial-analyst` | ✓ ready | cfo |
| `cfo.econ` | Financial Analyst | `financial-analyst` | ✓ ready | cfo |
| `cfo.forecast` | Financial Analyst | `financial-analyst` | ✓ ready | cfo |
| `cfo.treasury` | Bookkeeper | `bookkeeper` | ✓ ready | cfo |
| `cmo` | Cmo | `cmo` | ✓ ready | ceo.orchestrator |
| `cmo.advocacy` | Community Builder | `community-builder` | ○ pending | cmo |
| `cmo.brand` | Ad Creative Strategist | `ad-creative-strategist` | ○ pending | cmo |
| `cmo.content` | Content Creator | `content-creator` | ✓ ready | cmo |
| `cmo.demand` | Growth Hacker | `growth-hacker` | ✓ ready | cmo |
| `coo` | Coo | `coo` | ✓ ready | ceo.orchestrator |
| `coo.connector` | Composio Integration | `composio-integration` | ✓ ready | coo |
| `coo.credentials` | Composio Integration | `composio-integration` | ✓ ready | coo |
| `coo.dashboard` | Analytics Reporter | `analytics-reporter` | ✓ ready | coo |
| `coo.health` | Recovery Engineer | `recovery-engineer` | ✓ ready | coo |
| `coo.memory` | Devops Engineer | `devops-engineer` | ✓ ready | coo |
| `coo.observability` | Devops Engineer | `devops-engineer` | ✓ ready | coo |
| `coo.scheduler` | Devops Engineer | `devops-engineer` | ✓ ready | coo |
| `cpo` | Cpo | `cpo` | ✓ ready | ceo.orchestrator |
| `cpo.build` | Ai Engineer | `ai-engineer` | ✓ ready | cpo |
| `cpo.growth` | Growth Hacker | `growth-hacker` | ✓ ready | cpo |
| `cpo.qa` | Api Tester | `api-tester` | ✓ ready | cpo |
| `cpo.roadmap` | Product Manager | `product-manager` | ✓ ready | cpo |
| `cro` | Cro | `cro` | ✓ ready | ceo.orchestrator |
| `cro.close` | Sales Coach | `sales-coach` | ○ pending | cro |
| `cro.demo` | Sales Engineer | `sales-engineer` | ○ pending | cro |
| `cro.expansion` | Sales Coach | `sales-coach` | ✓ ready | cro |
| `cro.outbound` | Sales Coach | `sales-coach` | ○ pending | cro |

Manifest sha256: `sha256:a77be24dc206466e222afe16b4b8f6bb954b15ed078a0d4efd707f223f79fc4c` · finalize source: t2

---
## `iris` — EdTech · K-12 reading curriculum · district sales · long enterprise cycle

**Pillar inputs**
- Pillar 1: Iris Reading Lab · https://irisreading.example
  > Iris Reading Lab provides a structured-literacy reading curriculum + assessment tooling for K-12 districts. Long sales cycles (6-12mo), pilot → district-wide rollout. Per-student licensing $40/yr. Used in 80 districts.
- Pillar 3: product_state=live_paying_customers · stage=500k_1m_arr
- Pillar 4: lead_sources=[outbound_cold, events, partnerships] · sales_motion=high_touch_enterprise · close_channel=mostly_phone_video
- Pillar 5: comm_channel=email_only · urgency=all_to_one_channel

**Connectors**
- Required (5): claude-code, supabase, github, stripe, mixpanel
- Suggested (4): hubspot, linkedin-sales-nav, calendly, google_calendar
- Deferred (4): sendgrid, salesforce, docusign, segment

**Swarm topology**
- Active: 30 · Standby: 0 · Parked: 4 · Disabled: 0
- Total slots: 34

**Activated fleet (34 rows in DB)**

| Slot | Display | Template | Status | Reports to |
|---|---|---|---|---|
| `cdo` | Cdo | `cdo` | ✓ ready | ceo.orchestrator |
| `cdo.attribute` | Support Analytics | `support-analytics` | ✓ ready | cdo |
| `cdo.infer` | Prompt Engineer | `prompt-engineer` | ✓ ready | cdo |
| `cdo.signal` | Prompt Engineer | `prompt-engineer` | ✓ ready | cdo |
| `cdo.telemetry` | Support Analytics | `support-analytics` | ✓ ready | cdo |
| `ceo.orchestrator` | Ceo | `ceo` | ✓ ready | — |
| `cfo` | Cfo | `cfo` | ✓ ready | ceo.orchestrator |
| `cfo.capital` | Financial Analyst | `financial-analyst` | ✓ ready | cfo |
| `cfo.econ` | Financial Analyst | `financial-analyst` | ✓ ready | cfo |
| `cfo.forecast` | Financial Analyst | `financial-analyst` | ✓ ready | cfo |
| `cfo.treasury` | Bookkeeper | `bookkeeper` | ✓ ready | cfo |
| `cmo` | Cmo | `cmo` | ✓ ready | ceo.orchestrator |
| `cmo.advocacy` | Community Builder | `community-builder` | ○ pending | cmo |
| `cmo.brand` | Story Architect | `story-architect` | ○ pending | cmo |
| `cmo.content` | Story Architect | `story-architect` | ○ pending | cmo |
| `cmo.demand` | Community Builder | `community-builder` | ○ pending | cmo |
| `coo` | Coo | `coo` | ✓ ready | ceo.orchestrator |
| `coo.connector` | Composio Integration | `composio-integration` | ✓ ready | coo |
| `coo.credentials` | Composio Integration | `composio-integration` | ✓ ready | coo |
| `coo.dashboard` | Frontend Developer | `frontend-developer` | ✓ ready | coo |
| `coo.health` | Recovery Engineer | `recovery-engineer` | ✓ ready | coo |
| `coo.memory` | Devops Engineer | `devops-engineer` | ✓ ready | coo |
| `coo.observability` | Devops Engineer | `devops-engineer` | ✓ ready | coo |
| `coo.scheduler` | Experiment Tracker | `experiment-tracker` | ✓ ready | coo |
| `cpo` | Cpo | `cpo` | ✓ ready | ceo.orchestrator |
| `cpo.build` | Frontend Developer | `frontend-developer` | ✓ ready | cpo |
| `cpo.growth` | Experiment Tracker | `experiment-tracker` | ✓ ready | cpo |
| `cpo.qa` | Accessibility Auditor | `accessibility-auditor` | ✓ ready | cpo |
| `cpo.roadmap` | Product Manager | `product-manager` | ✓ ready | cpo |
| `cro` | Cro | `cro` | ✓ ready | ceo.orchestrator |
| `cro.close` | Sales Coach | `sales-coach` | ✓ ready | cro |
| `cro.demo` | Sales Engineer | `sales-engineer` | ✓ ready | cro |
| `cro.expansion` | Sales Coach | `sales-coach` | ✓ ready | cro |
| `cro.outbound` | Sales Coach | `sales-coach` | ✓ ready | cro |

Manifest sha256: `sha256:8995b382067a71c5170853ff48db19c606a827fc29419a5b137d3994d84971ad` · finalize source: t2

---
## `canopy` — DTC e-commerce · clean skincare brand · paid ads + influencers · subscription + one-time

**Pillar inputs**
- Pillar 1: Canopy · https://shopcanopy.example
  > Canopy is a DTC clean-skincare brand. Subscribe & save + one-time purchases. Heavy on Meta + TikTok paid ads + creator partnerships. ~30k email list, repeat rate 42%, AOV $68. Shopify Plus.
- Pillar 3: product_state=live_paying_customers · stage=1m_5m_arr
- Pillar 4: lead_sources=[inbound_ads_meta_google, partnerships, content_seo] · sales_motion=self_serve_plg · close_channel=mixed
- Pillar 5: comm_channel=slack · urgency=digest_plus_urgent_phone

**Connectors**
- Required (8): claude-code, shopify, supabase, github, slack, meta-ads-api, google-ads-api, mixpanel
- Suggested (3): stripe, klaviyo, shipstation
- Deferred (2): posthog, sendgrid

**Swarm topology**
- Active: 29 · Standby: 0 · Parked: 5 · Disabled: 0
- Total slots: 34

**Activated fleet (34 rows in DB)**

| Slot | Display | Template | Status | Reports to |
|---|---|---|---|---|
| `cdo` | Cdo | `cdo` | ✓ ready | ceo.orchestrator |
| `cdo.attribute` | Growth Experiment Designer | `growth-experiment-designer` | ✓ ready | cdo |
| `cdo.infer` | Image Prompt Engineer | `image-prompt-engineer` | ✓ ready | cdo |
| `cdo.signal` | Data Engineer | `data-engineer` | ✓ ready | cdo |
| `cdo.telemetry` | Data Engineer | `data-engineer` | ✓ ready | cdo |
| `ceo.orchestrator` | Ceo | `ceo` | ✓ ready | — |
| `cfo` | Cfo | `cfo` | ✓ ready | ceo.orchestrator |
| `cfo.capital` | Financial Analyst | `financial-analyst` | ✓ ready | cfo |
| `cfo.econ` | Financial Analyst | `financial-analyst` | ✓ ready | cfo |
| `cfo.forecast` | Financial Analyst | `financial-analyst` | ✓ ready | cfo |
| `cfo.treasury` | Bookkeeper | `bookkeeper` | ✓ ready | cfo |
| `cmo` | Cmo | `cmo` | ✓ ready | ceo.orchestrator |
| `cmo.advocacy` | Content Creator | `content-creator` | ○ pending | cmo |
| `cmo.brand` | Ad Creative Strategist | `ad-creative-strategist` | ○ pending | cmo |
| `cmo.content` | Content Creator | `content-creator` | ✓ ready | cmo |
| `cmo.demand` | Growth Hacker | `growth-hacker` | ✓ ready | cmo |
| `coo` | Coo | `coo` | ✓ ready | ceo.orchestrator |
| `coo.connector` | Composio Integration | `composio-integration` | ✓ ready | coo |
| `coo.credentials` | Composio Integration | `composio-integration` | ✓ ready | coo |
| `coo.dashboard` | Analytics Reporter | `analytics-reporter` | ✓ ready | coo |
| `coo.health` | Recovery Engineer | `recovery-engineer` | ✓ ready | coo |
| `coo.memory` | Executive Summary Generator | `executive-summary-generator` | ✓ ready | coo |
| `coo.observability` | Analytics Reporter | `analytics-reporter` | ✓ ready | coo |
| `coo.scheduler` | Devops Engineer | `devops-engineer` | ✓ ready | coo |
| `cpo` | Cpo | `cpo` | ✓ ready | ceo.orchestrator |
| `cpo.build` | Backend Architect | `backend-architect` | ✓ ready | cpo |
| `cpo.growth` | Growth Hacker | `growth-hacker` | ✓ ready | cpo |
| `cpo.qa` | Performance Benchmarker | `performance-benchmarker` | ✓ ready | cpo |
| `cpo.roadmap` | Ux Architect | `ux-architect` | ✓ ready | cpo |
| `cro` | Cro | `cro` | ✓ ready | ceo.orchestrator |
| `cro.close` | Sales Coach | `sales-coach` | ○ pending | cro |
| `cro.demo` | Sales Engineer | `sales-engineer` | ○ pending | cro |
| `cro.expansion` | Sales Coach | `sales-coach` | ✓ ready | cro |
| `cro.outbound` | Sales Coach | `sales-coach` | ○ pending | cro |

Manifest sha256: `sha256:4840905113f11936e4ff4137fbe385648c9d255595e9b44dd35b76f1351b80f0` · finalize source: t2

---
## `meridian` — B2B services · brand + product strategy consulting · retainer + project · founder-led sales

**Pillar inputs**
- Pillar 1: Meridian Strategy · https://meridianstrategy.example
  > Meridian is a 12-person brand + product strategy consultancy. Retainer ($25k-80k/mo) + project ($75k-300k) work for late-stage startups + scaleups. Founder-led sales, referral-heavy pipeline.
- Pillar 3: product_state=live_paying_customers · stage=1m_5m_arr
- Pillar 4: lead_sources=[referral_word_of_mouth, content_seo, events] · sales_motion=high_touch_enterprise · close_channel=mostly_phone_video
- Pillar 5: comm_channel=slack · urgency=all_to_one_channel

**Connectors**
- Required (5): claude-code, supabase, github, slack, mixpanel
- Suggested (5): stripe, hubspot, calendly, gmail, notion
- Deferred (3): hubspot, linkedin-sales-nav, linear

**Swarm topology**
- Active: 32 · Standby: 0 · Parked: 2 · Disabled: 0
- Total slots: 34

**Activated fleet (34 rows in DB)**

| Slot | Display | Template | Status | Reports to |
|---|---|---|---|---|
| `cdo` | Cdo | `cdo` | ✓ ready | ceo.orchestrator |
| `cdo.attribute` | Growth Experiment Designer | `growth-experiment-designer` | ✓ ready | cdo |
| `cdo.infer` | Prompt Engineer | `prompt-engineer` | ✓ ready | cdo |
| `cdo.signal` | Prompt Engineer | `prompt-engineer` | ✓ ready | cdo |
| `cdo.telemetry` | Analytics Reporter | `analytics-reporter` | ✓ ready | cdo |
| `ceo.orchestrator` | Ceo | `ceo` | ✓ ready | — |
| `cfo` | Cfo | `cfo` | ✓ ready | ceo.orchestrator |
| `cfo.capital` | Financial Analyst | `financial-analyst` | ✓ ready | cfo |
| `cfo.econ` | Financial Analyst | `financial-analyst` | ✓ ready | cfo |
| `cfo.forecast` | Financial Analyst | `financial-analyst` | ✓ ready | cfo |
| `cfo.treasury` | Bookkeeper | `bookkeeper` | ✓ ready | cfo |
| `cmo` | Cmo | `cmo` | ✓ ready | ceo.orchestrator |
| `cmo.advocacy` | Brand Guardian | `brand-guardian` | ✓ ready | cmo |
| `cmo.brand` | Brand Guardian | `brand-guardian` | ○ pending | cmo |
| `cmo.content` | Story Architect | `story-architect` | ✓ ready | cmo |
| `cmo.demand` | Growth Hacker | `growth-hacker` | ✓ ready | cmo |
| `coo` | Coo | `coo` | ✓ ready | ceo.orchestrator |
| `coo.connector` | Composio Integration | `composio-integration` | ✓ ready | coo |
| `coo.credentials` | Composio Integration | `composio-integration` | ✓ ready | coo |
| `coo.dashboard` | Analytics Reporter | `analytics-reporter` | ✓ ready | coo |
| `coo.health` | Incident Responder | `incident-responder` | ✓ ready | coo |
| `coo.memory` | Executive Summary Generator | `executive-summary-generator` | ✓ ready | coo |
| `coo.observability` | Analytics Reporter | `analytics-reporter` | ✓ ready | coo |
| `coo.scheduler` | Experiment Tracker | `experiment-tracker` | ✓ ready | coo |
| `cpo` | Cpo | `cpo` | ✓ ready | ceo.orchestrator |
| `cpo.build` | Backend Architect | `backend-architect` | ✓ ready | cpo |
| `cpo.growth` | Experiment Tracker | `experiment-tracker` | ✓ ready | cpo |
| `cpo.qa` | Accessibility Auditor | `accessibility-auditor` | ✓ ready | cpo |
| `cpo.roadmap` | Ux Architect | `ux-architect` | ✓ ready | cpo |
| `cro` | Cro | `cro` | ✓ ready | ceo.orchestrator |
| `cro.close` | Sales Coach | `sales-coach` | ✓ ready | cro |
| `cro.demo` | Sales Engineer | `sales-engineer` | ✓ ready | cro |
| `cro.expansion` | Sales Coach | `sales-coach` | ✓ ready | cro |
| `cro.outbound` | Sales Coach | `sales-coach` | ○ pending | cro |

Manifest sha256: `sha256:a6ef2b0d15131b2fc95903842691fe16d7dd7c8371f27678aff1410452ce1dec` · finalize source: t2

---
## `ironside` — FinTech · embedded payments + reconciliation · regulated · enterprise procurement

**Pillar inputs**
- Pillar 1: Ironside · https://ironside-pay.example
  > Ironside provides embedded payments + reconciliation infrastructure for vertical SaaS platforms. SOC2 Type 2, PCI-DSS Level 1. Sells to platforms doing $10M-$1B in flow. Long enterprise procurement (3-9mo).
- Pillar 3: product_state=live_paying_customers · stage=5m_10m_arr
- Pillar 4: lead_sources=[outbound_cold, partnerships, events] · sales_motion=high_touch_enterprise · close_channel=mostly_phone_video
- Pillar 5: comm_channel=slack · urgency=digest_plus_urgent_phone

**Connectors**
- Required (5): claude-code, supabase, slack, github, hubspot
- Suggested (5): mixpanel, posthog, linkedin-sales-nav, calendly, gmail
- Deferred (3): salesforce, docusign, stripe

**Swarm topology**
- Active: 31 · Standby: 0 · Parked: 3 · Disabled: 0
- Total slots: 34

**Activated fleet (34 rows in DB)**

| Slot | Display | Template | Status | Reports to |
|---|---|---|---|---|
| `cdo` | Cdo | `cdo` | ✓ ready | ceo.orchestrator |
| `cdo.attribute` | Support Analytics | `support-analytics` | ✓ ready | cdo |
| `cdo.infer` | Prompt Engineer | `prompt-engineer` | ✓ ready | cdo |
| `cdo.signal` | Mlops Engineer | `mlops-engineer` | ✓ ready | cdo |
| `cdo.telemetry` | Data Engineer | `data-engineer` | ✓ ready | cdo |
| `ceo.orchestrator` | Ceo | `ceo` | ✓ ready | — |
| `cfo` | Cfo | `cfo` | ✓ ready | ceo.orchestrator |
| `cfo.capital` | Financial Analyst | `financial-analyst` | ✓ ready | cfo |
| `cfo.econ` | Financial Analyst | `financial-analyst` | ✓ ready | cfo |
| `cfo.forecast` | Financial Analyst | `financial-analyst` | ✓ ready | cfo |
| `cfo.treasury` | Bookkeeper | `bookkeeper` | ✓ ready | cfo |
| `cmo` | Cmo | `cmo` | ✓ ready | ceo.orchestrator |
| `cmo.advocacy` | Brand Guardian | `brand-guardian` | ✓ ready | cmo |
| `cmo.brand` | Brand Guardian | `brand-guardian` | ○ pending | cmo |
| `cmo.content` | Story Architect | `story-architect` | ○ pending | cmo |
| `cmo.demand` | Community Builder | `community-builder` | ○ pending | cmo |
| `coo` | Coo | `coo` | ✓ ready | ceo.orchestrator |
| `coo.connector` | Composio Integration | `composio-integration` | ✓ ready | coo |
| `coo.credentials` | Composio Integration | `composio-integration` | ✓ ready | coo |
| `coo.dashboard` | Frontend Developer | `frontend-developer` | ✓ ready | coo |
| `coo.health` | Incident Responder | `incident-responder` | ✓ ready | coo |
| `coo.memory` | Devops Engineer | `devops-engineer` | ✓ ready | coo |
| `coo.observability` | Devops Engineer | `devops-engineer` | ✓ ready | coo |
| `coo.scheduler` | Experiment Tracker | `experiment-tracker` | ✓ ready | coo |
| `cpo` | Cpo | `cpo` | ✓ ready | ceo.orchestrator |
| `cpo.build` | Backend Architect | `backend-architect` | ✓ ready | cpo |
| `cpo.growth` | Experiment Tracker | `experiment-tracker` | ✓ ready | cpo |
| `cpo.qa` | Api Tester | `api-tester` | ✓ ready | cpo |
| `cpo.roadmap` | Ux Architect | `ux-architect` | ✓ ready | cpo |
| `cro` | Cro | `cro` | ✓ ready | ceo.orchestrator |
| `cro.close` | Sales Coach | `sales-coach` | ✓ ready | cro |
| `cro.demo` | Sales Engineer | `sales-engineer` | ✓ ready | cro |
| `cro.expansion` | Sales Coach | `sales-coach` | ✓ ready | cro |
| `cro.outbound` | Sales Coach | `sales-coach` | ✓ ready | cro |

Manifest sha256: `sha256:e289e02d8f422cbd040383fbba2398d8e9d1a4943277795971f6150140d32077` · finalize source: t2

---
## `vitalis` — HealthTech · clinician burnout AI scribe · HIPAA · health-system sales

**Pillar inputs**
- Pillar 1: Vitalis · https://vitalis-scribe.example
  > Vitalis is an AI medical scribe reducing clinician documentation burden in primary care + specialty clinics. HIPAA compliant, BAAs in place. Sells to health systems + medical groups. Pilot → multi-site rollout.
- Pillar 3: product_state=live_paying_customers · stage=100k_500k_arr
- Pillar 4: lead_sources=[outbound_cold, partnerships, events] · sales_motion=high_touch_enterprise · close_channel=mostly_phone_video
- Pillar 5: comm_channel=email_only · urgency=digest_plus_urgent_phone

**Connectors**
- Required (3): claude-code, github, supabase
- Suggested (7): mixpanel, plaid, hubspot, linkedin-sales-nav, calendly, sendgrid, stripe
- Deferred (3): salesforce, docusign, gmail

**Swarm topology**
- Active: 30 · Standby: 0 · Parked: 4 · Disabled: 0
- Total slots: 34

**Activated fleet (34 rows in DB)**

| Slot | Display | Template | Status | Reports to |
|---|---|---|---|---|
| `cdo` | Cdo | `cdo` | ✓ ready | ceo.orchestrator |
| `cdo.attribute` | Support Analytics | `support-analytics` | ✓ ready | cdo |
| `cdo.infer` | Prompt Engineer | `prompt-engineer` | ✓ ready | cdo |
| `cdo.signal` | Prompt Engineer | `prompt-engineer` | ✓ ready | cdo |
| `cdo.telemetry` | Support Analytics | `support-analytics` | ✓ ready | cdo |
| `ceo.orchestrator` | Ceo | `ceo` | ✓ ready | — |
| `cfo` | Cfo | `cfo` | ✓ ready | ceo.orchestrator |
| `cfo.capital` | Financial Analyst | `financial-analyst` | ✓ ready | cfo |
| `cfo.econ` | Financial Analyst | `financial-analyst` | ✓ ready | cfo |
| `cfo.forecast` | Financial Analyst | `financial-analyst` | ✓ ready | cfo |
| `cfo.treasury` | Bookkeeper | `bookkeeper` | ✓ ready | cfo |
| `cmo` | Cmo | `cmo` | ✓ ready | ceo.orchestrator |
| `cmo.advocacy` | Community Builder | `community-builder` | ○ pending | cmo |
| `cmo.brand` | Story Architect | `story-architect` | ○ pending | cmo |
| `cmo.content` | Story Architect | `story-architect` | ○ pending | cmo |
| `cmo.demand` | Community Builder | `community-builder` | ○ pending | cmo |
| `coo` | Coo | `coo` | ✓ ready | ceo.orchestrator |
| `coo.connector` | Composio Integration | `composio-integration` | ✓ ready | coo |
| `coo.credentials` | Composio Integration | `composio-integration` | ✓ ready | coo |
| `coo.dashboard` | Frontend Developer | `frontend-developer` | ✓ ready | coo |
| `coo.health` | Incident Responder | `incident-responder` | ✓ ready | coo |
| `coo.memory` | Devops Engineer | `devops-engineer` | ✓ ready | coo |
| `coo.observability` | Devops Engineer | `devops-engineer` | ✓ ready | coo |
| `coo.scheduler` | Experiment Tracker | `experiment-tracker` | ✓ ready | coo |
| `cpo` | Cpo | `cpo` | ✓ ready | ceo.orchestrator |
| `cpo.build` | Backend Architect | `backend-architect` | ✓ ready | cpo |
| `cpo.growth` | Experiment Tracker | `experiment-tracker` | ✓ ready | cpo |
| `cpo.qa` | Evidence Collector | `evidence-collector` | ✓ ready | cpo |
| `cpo.roadmap` | Product Manager | `product-manager` | ✓ ready | cpo |
| `cro` | Cro | `cro` | ✓ ready | ceo.orchestrator |
| `cro.close` | Sales Coach | `sales-coach` | ✓ ready | cro |
| `cro.demo` | Solutions Architect | `solutions-architect` | ✓ ready | cro |
| `cro.expansion` | Sales Coach | `sales-coach` | ✓ ready | cro |
| `cro.outbound` | Outbound Prospector | `outbound-prospector` | ✓ ready | cro |

Manifest sha256: `sha256:adf6ebdb9d24e8221504745a05a66777222d9c0cdd3792847510274b58b04480` · finalize source: t2

---
## `helix` — Open-source dev tool · CLI for vector data pipelines · community-led · cloud-hosted SaaS sidecar

**Pillar inputs**
- Pillar 1: Helix · https://github.com/helix-vector/helix
  > Helix is an open-source CLI + library for managing vector data pipelines (embeddings, similarity search, eval harnesses). 8k GitHub stars, 200+ contributors. Monetizing via Helix Cloud — managed indexes + collaboration. ~$300k ARR.
- Pillar 3: product_state=live_paying_customers · stage=100k_500k_arr
- Pillar 4: lead_sources=[content_seo, content_seo, partnerships] · sales_motion=self_serve_plg · close_channel=mixed
- Pillar 5: comm_channel=slack · urgency=all_to_one_channel

**Connectors**
- Required (5): claude-code, supabase, slack, mixpanel, github
- Suggested (4): posthog, stripe, linear, anthropic
- Deferred (2): hubspot, sendgrid

**Swarm topology**
- Active: 30 · Standby: 0 · Parked: 4 · Disabled: 0
- Total slots: 34

**Activated fleet (34 rows in DB)**

| Slot | Display | Template | Status | Reports to |
|---|---|---|---|---|
| `cdo` | Cdo | `cdo` | ✓ ready | ceo.orchestrator |
| `cdo.attribute` | Support Analytics | `support-analytics` | ✓ ready | cdo |
| `cdo.infer` | Ai Engineer | `ai-engineer` | ✓ ready | cdo |
| `cdo.signal` | Ai Engineer | `ai-engineer` | ✓ ready | cdo |
| `cdo.telemetry` | Support Analytics | `support-analytics` | ✓ ready | cdo |
| `ceo.orchestrator` | Ceo | `ceo` | ✓ ready | — |
| `cfo` | Cfo | `cfo` | ✓ ready | ceo.orchestrator |
| `cfo.capital` | Financial Analyst | `financial-analyst` | ✓ ready | cfo |
| `cfo.econ` | Financial Analyst | `financial-analyst` | ✓ ready | cfo |
| `cfo.forecast` | Financial Analyst | `financial-analyst` | ✓ ready | cfo |
| `cfo.treasury` | Bookkeeper | `bookkeeper` | ✓ ready | cfo |
| `cmo` | Cmo | `cmo` | ✓ ready | ceo.orchestrator |
| `cmo.advocacy` | Community Builder | `community-builder` | ✓ ready | cmo |
| `cmo.brand` | Content Creator | `content-creator` | ○ pending | cmo |
| `cmo.content` | Content Creator | `content-creator` | ✓ ready | cmo |
| `cmo.demand` | Community Builder | `community-builder` | ✓ ready | cmo |
| `coo` | Coo | `coo` | ✓ ready | ceo.orchestrator |
| `coo.connector` | Composio Integration | `composio-integration` | ✓ ready | coo |
| `coo.credentials` | Composio Integration | `composio-integration` | ✓ ready | coo |
| `coo.dashboard` | Frontend Developer | `frontend-developer` | ✓ ready | coo |
| `coo.health` | Recovery Engineer | `recovery-engineer` | ✓ ready | coo |
| `coo.memory` | Devops Engineer | `devops-engineer` | ✓ ready | coo |
| `coo.observability` | Devops Engineer | `devops-engineer` | ✓ ready | coo |
| `coo.scheduler` | Devops Engineer | `devops-engineer` | ✓ ready | coo |
| `cpo` | Cpo | `cpo` | ✓ ready | ceo.orchestrator |
| `cpo.build` | Backend Architect | `backend-architect` | ✓ ready | cpo |
| `cpo.growth` | Growth Hacker | `growth-hacker` | ✓ ready | cpo |
| `cpo.qa` | Api Tester | `api-tester` | ✓ ready | cpo |
| `cpo.roadmap` | Product Manager | `product-manager` | ✓ ready | cpo |
| `cro` | Cro | `cro` | ✓ ready | ceo.orchestrator |
| `cro.close` | Sales Coach | `sales-coach` | ○ pending | cro |
| `cro.demo` | Sales Engineer | `sales-engineer` | ○ pending | cro |
| `cro.expansion` | Sales Coach | `sales-coach` | ✓ ready | cro |
| `cro.outbound` | Sales Coach | `sales-coach` | ○ pending | cro |

Manifest sha256: `sha256:82e7d61cdbe107e7fd8fc614dc336a2c46f081f3b405f83ae7b7fd4aaa6a035a` · finalize source: t2
