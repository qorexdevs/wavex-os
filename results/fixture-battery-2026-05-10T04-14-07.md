# Fixture Battery — 20 variants

Generated: 2026-05-10T04:14:07.866Z
Mode: skipInference (T0 fast)

## Cross-fixture summary

| Tag | Industry shape | Required | Suggested | Active | Standby | Parked | Disabled |
|---|---|---|---|---|---|---|---|
| **acme** | B2B SaaS · workflow automation · $1k-5k/mo · assisted demo ·… | 5 | 1 | 32 | 0 | 2 | 0 |
| **pulse** | Pre-product · AI fitness coaching for solo trainers · idea_o… | 3 | 1 | 20 | 0 | 13 | 1 |
| **ricoma** | Hardware manufacturer · commercial embroidery machines · DTC… | 7 | 1 | 31 | 0 | 3 | 0 |
| **rho** | Two-sided marketplace · independent contractors connecting t… | 5 | 4 | 29 | 0 | 5 | 0 |
| **iris** | EdTech · K-12 reading curriculum · district sales · long ent… | 5 | 0 | 30 | 0 | 4 | 0 |
| **canopy** | DTC e-commerce · clean skincare brand · paid ads + influence… | 8 | 0 | 29 | 0 | 5 | 0 |
| **meridian** | B2B services · brand + product strategy consulting · retaine… | 5 | 1 | 32 | 0 | 2 | 0 |
| **ironside** | FinTech · embedded payments + reconciliation · regulated · e… | 4 | 2 | 31 | 0 | 3 | 0 |
| **vitalis** | HealthTech · clinician burnout AI scribe · HIPAA · health-sy… | 3 | 2 | 30 | 0 | 4 | 0 |
| **helix** | Open-source dev tool · CLI for vector data pipelines · commu… | 5 | 1 | 30 | 0 | 4 | 0 |
| **notion** | B2B/B2C productivity SaaS · all-in-one workspace · freemium … | 4 | 2 | 29 | 0 | 5 | 0 |
| **figma** | B2B SaaS · collaborative design tool · enterprise + PLG · de… | 5 | 1 | 29 | 0 | 5 | 0 |
| **stripe** | FinTech · payments infrastructure · enterprise sales + self-… | 4 | 2 | 32 | 0 | 2 | 0 |
| **ramp** | FinTech · corporate cards + AP automation · CFO-targeted ent… | 5 | 1 | 32 | 0 | 2 | 0 |
| **posthog** | OSS B2B · product analytics + session replay · self-host or … | 5 | 1 | 30 | 0 | 4 | 0 |
| **supabase** | OSS B2B · open-source Firebase alternative · Postgres + auth… | 5 | 1 | 30 | 0 | 4 | 0 |
| **zapier** | B2B SaaS · no-code integration platform · 6000+ app catalog … | 5 | 1 | 29 | 0 | 5 | 0 |
| **retool** | B2B SaaS · low-code internal tools · enterprise sales · deve… | 4 | 2 | 31 | 0 | 3 | 0 |
| **peloton** | Hardware + content · connected fitness · DTC consumer · subs… | 6 | 4 | 29 | 0 | 5 | 0 |
| **duolingo** | Consumer EdTech · gamified language learning · freemium + Du… | 5 | 3 | 29 | 0 | 5 | 0 |

## Per-slot template selection across all fixtures

| Slot | acme | pulse | ricoma | rho | iris | canopy | meridian | ironside | vitalis | helix | notion | figma | stripe | ramp | posthog | supabase | zapier | retool | peloton | duolingo |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `cdo` | ✓ cdo | ✓ cdo | ✓ cdo | ✓ cdo | ✓ cdo | ✓ cdo | ✓ cdo | ✓ cdo | ✓ cdo | ✓ cdo | ✓ cdo | ✓ cdo | ✓ cdo | ✓ cdo | ✓ cdo | ✓ cdo | ✓ cdo | ✓ cdo | ✓ cdo | ✓ cdo |
| `cdo.attribute` | ✓ support-analytics | ○ support-analytics | ✓ support-analytics | ✓ support-analytics | ✓ support-analytics | ✓ growth-experiment-designer | ✓ growth-experiment-designer | ✓ support-analytics | ✓ support-analytics | ✓ support-analytics | ✓ support-analytics | ✓ support-analytics | ✓ support-analytics | ✓ support-analytics | ✓ support-analytics | ✓ support-analytics | ✓ support-analytics | ✓ support-analytics | ✓ growth-experiment-designer | ✓ support-analytics |
| `cdo.infer` | ✓ ai-engineer | ✓ ai-engineer | ✓ ai-engineer | ✓ ai-engineer | ✓ prompt-engineer | ✓ image-prompt-engineer | ✓ prompt-engineer | ✓ prompt-engineer | ✓ prompt-engineer | ✓ ai-engineer | ✓ ai-engineer | ✓ ai-engineer | ✓ prompt-engineer | ✓ prompt-engineer | ✓ ai-engineer | ✓ ai-engineer | ✓ ai-engineer | ✓ ai-engineer | ✓ image-prompt-engineer | ✓ ai-engineer |
| `cdo.signal` | ✓ ai-engineer | ✓ ai-engineer | ✓ ai-engineer | ✓ ai-engineer | ✓ prompt-engineer | ✓ data-engineer | ✓ prompt-engineer | ✓ mlops-engineer | ✓ prompt-engineer | ✓ ai-engineer | ✓ ai-engineer | ✓ ai-engineer | ✓ reality-checker | ✓ reality-checker | ✓ ai-engineer | ✓ ai-engineer | ✓ ai-engineer | ✓ mlops-engineer | ✓ ai-engineer | ✓ ai-engineer |
| `cdo.telemetry` | ✓ support-analytics | ✓ support-analytics | ✓ support-analytics | ✓ support-analytics | ✓ support-analytics | ✓ data-engineer | ✓ analytics-reporter | ✓ data-engineer | ✓ support-analytics | ✓ support-analytics | ✓ support-analytics | ✓ support-analytics | ✓ support-analytics | ✓ support-analytics | ✓ data-engineer | ✓ support-analytics | ✓ support-analytics | ✓ support-analytics | ✓ analytics-reporter | ✓ support-analytics |
| `ceo.orchestrator` | ✓ ceo | ✓ ceo | ✓ ceo | ✓ ceo | ✓ ceo | ✓ ceo | ✓ ceo | ✓ ceo | ✓ ceo | ✓ ceo | ✓ ceo | ✓ ceo | ✓ ceo | ✓ ceo | ✓ ceo | ✓ ceo | ✓ ceo | ✓ ceo | ✓ ceo | ✓ ceo |
| `cfo` | ✓ cfo | ✓ cfo | ✓ cfo | ✓ cfo | ✓ cfo | ✓ cfo | ✓ cfo | ✓ cfo | ✓ cfo | ✓ cfo | ✓ cfo | ✓ cfo | ✓ cfo | ✓ cfo | ✓ cfo | ✓ cfo | ✓ cfo | ✓ cfo | ✓ cfo | ✓ cfo |
| `cfo.capital` | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst |
| `cfo.econ` | ✓ financial-analyst | ✗ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst |
| `cfo.forecast` | ✓ financial-analyst | ○ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst | ✓ financial-analyst |
| `cfo.treasury` | ✓ bookkeeper | ○ bookkeeper | ✓ bookkeeper | ✓ bookkeeper | ✓ bookkeeper | ✓ bookkeeper | ✓ bookkeeper | ✓ bookkeeper | ✓ bookkeeper | ✓ bookkeeper | ✓ bookkeeper | ✓ bookkeeper | ✓ bookkeeper | ✓ bookkeeper | ✓ bookkeeper | ✓ bookkeeper | ✓ bookkeeper | ✓ bookkeeper | ✓ bookkeeper | ✓ bookkeeper |
| `cmo` | ✓ cmo | ✓ cmo | ✓ cmo | ✓ cmo | ✓ cmo | ✓ cmo | ✓ cmo | ✓ cmo | ✓ cmo | ✓ cmo | ✓ cmo | ✓ cmo | ✓ cmo | ✓ cmo | ✓ cmo | ✓ cmo | ✓ cmo | ✓ cmo | ✓ cmo | ✓ cmo |
| `cmo.advocacy` | ○ community-builder | ○ community-builder | ○ brand-guardian | ○ community-builder | ○ community-builder | ○ content-creator | ✓ brand-guardian | ✓ brand-guardian | ○ community-builder | ✓ community-builder | ○ community-builder | ○ community-builder | ✓ brand-guardian | ○ brand-guardian | ✓ community-builder | ✓ community-builder | ○ community-builder | ○ brand-guardian | ○ content-creator | ○ community-builder |
| `cmo.brand` | ○ content-creator | ✓ ad-creative-strategist | ○ ad-creative-strategist | ○ ad-creative-strategist | ○ story-architect | ○ ad-creative-strategist | ○ brand-guardian | ○ brand-guardian | ○ story-architect | ○ content-creator | ○ ad-creative-strategist | ○ content-creator | ○ brand-guardian | ○ brand-guardian | ○ ad-creative-strategist | ○ content-creator | ○ ad-creative-strategist | ○ brand-guardian | ○ ad-creative-strategist | ○ content-creator |
| `cmo.content` | ✓ content-creator | ○ content-creator | ✓ story-architect | ✓ content-creator | ○ story-architect | ✓ content-creator | ✓ story-architect | ○ story-architect | ○ story-architect | ✓ content-creator | ✓ content-creator | ✓ content-creator | ✓ story-architect | ✓ story-architect | ✓ content-creator | ✓ content-creator | ✓ content-creator | ✓ content-creator | ✓ content-creator | ✓ content-creator |
| `cmo.demand` | ✓ growth-hacker | ○ community-builder | ✓ growth-hacker | ✓ growth-hacker | ○ community-builder | ✓ growth-hacker | ✓ growth-hacker | ○ community-builder | ○ community-builder | ✓ community-builder | ✓ community-builder | ✓ community-builder | ✓ community-builder | ✓ community-builder | ✓ community-builder | ✓ community-builder | ✓ community-builder | ✓ growth-hacker | ✓ growth-hacker | ✓ community-builder |
| `coo` | ✓ coo | ✓ coo | ✓ coo | ✓ coo | ✓ coo | ✓ coo | ✓ coo | ✓ coo | ✓ coo | ✓ coo | ✓ coo | ✓ coo | ✓ coo | ✓ coo | ✓ coo | ✓ coo | ✓ coo | ✓ coo | ✓ coo | ✓ coo |
| `coo.connector` | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration |
| `coo.credentials` | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration | ✓ composio-integration |
| `coo.dashboard` | ✓ frontend-developer | ○ frontend-developer | ✓ analytics-reporter | ✓ analytics-reporter | ✓ frontend-developer | ✓ analytics-reporter | ✓ analytics-reporter | ✓ frontend-developer | ✓ frontend-developer | ✓ frontend-developer | ✓ frontend-developer | ✓ frontend-developer | ✓ frontend-developer | ✓ frontend-developer | ✓ frontend-developer | ✓ frontend-developer | ✓ frontend-developer | ✓ frontend-developer | ✓ ui-designer | ✓ analytics-reporter |
| `coo.health` | ✓ recovery-engineer | ✓ recovery-engineer | ✓ recovery-engineer | ✓ recovery-engineer | ✓ recovery-engineer | ✓ recovery-engineer | ✓ incident-responder | ✓ incident-responder | ✓ incident-responder | ✓ recovery-engineer | ✓ infrastructure-maintainer | ✓ infrastructure-maintainer | ✓ incident-responder | ✓ incident-responder | ✓ infrastructure-maintainer | ✓ infrastructure-maintainer | ✓ infrastructure-maintainer | ✓ incident-responder | ✓ infrastructure-maintainer | ✓ infrastructure-maintainer |
| `coo.memory` | ✓ devops-engineer | ✓ devops-engineer | ✓ feedback-synthesizer | ✓ devops-engineer | ✓ devops-engineer | ✓ executive-summary-generator | ✓ executive-summary-generator | ✓ devops-engineer | ✓ devops-engineer | ✓ devops-engineer | ✓ devops-engineer | ✓ devops-engineer | ✓ devops-engineer | ✓ devops-engineer | ✓ devops-engineer | ✓ devops-engineer | ✓ devops-engineer | ✓ devops-engineer | ✓ feedback-synthesizer | ✓ devops-engineer |
| `coo.observability` | ✓ devops-engineer | ✓ devops-engineer | ✓ analytics-reporter | ✓ devops-engineer | ✓ devops-engineer | ✓ analytics-reporter | ✓ analytics-reporter | ✓ devops-engineer | ✓ devops-engineer | ✓ devops-engineer | ✓ devops-engineer | ✓ devops-engineer | ✓ devops-engineer | ✓ devops-engineer | ✓ devops-engineer | ✓ devops-engineer | ✓ devops-engineer | ✓ devops-engineer | ✓ analytics-reporter | ✓ analytics-reporter |
| `coo.scheduler` | ✓ devops-engineer | ✓ devops-engineer | ✓ devops-engineer | ✓ devops-engineer | ✓ experiment-tracker | ✓ devops-engineer | ✓ experiment-tracker | ✓ experiment-tracker | ✓ experiment-tracker | ✓ devops-engineer | ✓ devops-engineer | ✓ devops-engineer | ✓ experiment-tracker | ✓ experiment-tracker | ✓ devops-engineer | ✓ devops-engineer | ✓ devops-engineer | ✓ devops-engineer | ✓ devops-engineer | ✓ devops-engineer |
| `cpo` | ✓ cpo | ✓ cpo | ✓ cpo | ✓ cpo | ✓ cpo | ✓ cpo | ✓ cpo | ✓ cpo | ✓ cpo | ✓ cpo | ✓ cpo | ✓ cpo | ✓ cpo | ✓ cpo | ✓ cpo | ✓ cpo | ✓ cpo | ✓ cpo | ✓ cpo | ✓ cpo |
| `cpo.build` | ✓ backend-architect | ✓ backend-architect | ✓ ai-engineer | ✓ ai-engineer | ✓ frontend-developer | ✓ backend-architect | ✓ backend-architect | ✓ backend-architect | ✓ backend-architect | ✓ backend-architect | ✓ backend-architect | ✓ backend-architect | ✓ backend-architect | ✓ backend-architect | ✓ backend-architect | ✓ backend-architect | ✓ backend-architect | ✓ backend-architect | ✓ backend-architect | ✓ backend-architect |
| `cpo.growth` | ✓ growth-hacker | ○ growth-hacker | ✓ growth-hacker | ✓ growth-hacker | ✓ experiment-tracker | ✓ growth-hacker | ✓ experiment-tracker | ✓ experiment-tracker | ✓ experiment-tracker | ✓ growth-hacker | ✓ growth-hacker | ✓ growth-hacker | ✓ experiment-tracker | ✓ experiment-tracker | ✓ growth-hacker | ✓ growth-hacker | ✓ growth-hacker | ✓ growth-hacker | ✓ growth-hacker | ✓ growth-hacker |
| `cpo.qa` | ✓ api-tester | ○ api-tester | ✓ accessibility-auditor | ✓ api-tester | ✓ accessibility-auditor | ✓ performance-benchmarker | ✓ accessibility-auditor | ✓ api-tester | ✓ evidence-collector | ✓ api-tester | ✓ api-tester | ✓ api-tester | ✓ evidence-collector | ✓ evidence-collector | ✓ api-tester | ✓ api-tester | ✓ api-tester | ✓ api-tester | ✓ performance-benchmarker | ✓ accessibility-auditor |
| `cpo.roadmap` | ✓ product-manager | ✓ product-manager | ✓ product-manager | ✓ product-manager | ✓ product-manager | ✓ ux-architect | ✓ ux-architect | ✓ ux-architect | ✓ product-manager | ✓ product-manager | ✓ ux-architect | ✓ ux-architect | ✓ ux-architect | ✓ ux-architect | ✓ ux-architect | ✓ ux-architect | ✓ ux-architect | ✓ product-manager | ✓ ux-architect | ✓ ux-architect |
| `cro` | ✓ cro | ✓ cro | ✓ cro | ✓ cro | ✓ cro | ✓ cro | ✓ cro | ✓ cro | ✓ cro | ✓ cro | ✓ cro | ✓ cro | ✓ cro | ✓ cro | ✓ cro | ✓ cro | ✓ cro | ✓ cro | ✓ cro | ✓ cro |
| `cro.close` | ✓ deal-strategist | ○ sales-coach | ✓ sales-coach | ○ sales-coach | ✓ sales-coach | ○ sales-coach | ✓ sales-coach | ✓ sales-coach | ✓ sales-coach | ○ sales-coach | ○ sales-coach | ○ sales-coach | ✓ sales-coach | ✓ sales-coach | ○ sales-coach | ○ sales-coach | ○ sales-coach | ✓ sales-coach | ○ sales-coach | ○ sales-coach |
| `cro.demo` | ✓ sales-engineer | ○ sales-engineer | ✓ sales-engineer | ○ sales-engineer | ✓ sales-engineer | ○ sales-engineer | ✓ sales-engineer | ✓ sales-engineer | ✓ solutions-architect | ○ sales-engineer | ○ sales-engineer | ○ sales-engineer | ✓ solutions-architect | ✓ solutions-architect | ○ sales-engineer | ○ sales-engineer | ○ sales-engineer | ✓ sales-engineer | ○ sales-engineer | ○ sales-engineer |
| `cro.expansion` | ✓ account-strategist | ○ sales-coach | ✓ sales-coach | ✓ sales-coach | ✓ sales-coach | ✓ sales-coach | ✓ sales-coach | ✓ sales-coach | ✓ sales-coach | ✓ sales-coach | ✓ sales-coach | ✓ sales-coach | ✓ sales-coach | ✓ sales-coach | ✓ sales-coach | ✓ sales-coach | ✓ sales-coach | ✓ sales-coach | ✓ sales-coach | ✓ sales-coach |
| `cro.outbound` | ✓ account-strategist | ○ sales-coach | ○ sales-coach | ○ sales-coach | ✓ sales-coach | ○ sales-coach | ○ sales-coach | ✓ sales-coach | ✓ outbound-prospector | ○ sales-coach | ○ sales-coach | ○ sales-coach | ○ sales-coach | ✓ sales-coach | ○ sales-coach | ○ sales-coach | ○ sales-coach | ○ sales-coach | ○ sales-coach | ○ sales-coach |

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
- Suggested (1): hubspot
- Deferred (1): linkedin-sales-nav

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

Manifest sha256: `sha256:73051536d47e45ed023f436883b2ecd557115ac712955eda9fbbfd25db2ee698` · finalize source: fallback

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
- Suggested (1): supabase
- Deferred (4): stripe, hubspot, mixpanel, mixpanel

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

Manifest sha256: `sha256:99494e9e868f04bdd7e7efff4337ce8fe5be8b9372fca03aa7cf205c286216e4` · finalize source: fallback

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
- Suggested (1): klaviyo
- Deferred (1): shipstation

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

Manifest sha256: `sha256:ddc062350abaa7fc82a7cbac7669e471d52545e3f456d6f983f189d9a1a62c58` · finalize source: fallback

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
- Suggested (4): meta-ads-api, google-ads-api, mixpanel, segment
- Deferred (1): shipstation

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

Manifest sha256: `sha256:3bd8eff300f6eef35159b81985c3488644f136771d2368fb39e7644864a1c3b9` · finalize source: fallback

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
- Suggested (0): —
- Deferred (4): linkedin-sales-nav, hubspot, sendgrid, mixpanel

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

Manifest sha256: `sha256:ae32454508c7d48bc9d4ff869dbea12c92ffeabb11b02369fdc3f273e0c789a9` · finalize source: fallback

---
## `canopy` — DTC e-commerce · clean skincare brand · paid ads + influencers · subscription + one-time

**Pillar inputs**
- Pillar 1: Canopy · https://shopcanopy.example
  > Canopy is a DTC clean-skincare brand. Subscribe & save + one-time purchases. Heavy on Meta + TikTok paid ads + creator partnerships. ~30k email list, repeat rate 42%, AOV $68. Shopify Plus.
- Pillar 3: product_state=live_paying_customers · stage=1m_5m_arr
- Pillar 4: lead_sources=[inbound_ads_meta_google, partnerships, content_seo] · sales_motion=self_serve_plg · close_channel=mixed
- Pillar 5: comm_channel=slack · urgency=digest_plus_urgent_phone

**Connectors**
- Required (8): claude-code, supabase, github, slack, meta-ads-api, google-ads-api, mixpanel, shopify
- Suggested (0): —
- Deferred (0): —

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

Manifest sha256: `sha256:47d610a9a8f28ca38df7ccd8e5b1cdead93a94fbab7f2e495529074781042e85` · finalize source: fallback

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
- Suggested (1): stripe
- Deferred (2): hubspot, mixpanel

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

Manifest sha256: `sha256:32ffb79152d102e3ffc80a5d323c0600974f3b3a8b9ec5498ec9fcf468e89e88` · finalize source: fallback

---
## `ironside` — FinTech · embedded payments + reconciliation · regulated · enterprise procurement

**Pillar inputs**
- Pillar 1: Ironside · https://ironside-pay.example
  > Ironside provides embedded payments + reconciliation infrastructure for vertical SaaS platforms. SOC2 Type 2, PCI-DSS Level 1. Sells to platforms doing $10M-$1B in flow. Long enterprise procurement (3-9mo).
- Pillar 3: product_state=live_paying_customers · stage=5m_10m_arr
- Pillar 4: lead_sources=[outbound_cold, partnerships, events] · sales_motion=high_touch_enterprise · close_channel=mostly_phone_video
- Pillar 5: comm_channel=slack · urgency=digest_plus_urgent_phone

**Connectors**
- Required (4): claude-code, supabase, slack, github
- Suggested (2): mixpanel, posthog
- Deferred (2): linkedin-sales-nav, hubspot

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

Manifest sha256: `sha256:dba7d7771dcc3f3a97129910a6bdecb7588dc2c11756180c209ae49f19066a14` · finalize source: fallback

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
- Suggested (2): mixpanel, plaid
- Deferred (2): linkedin-sales-nav, hubspot

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

Manifest sha256: `sha256:75a311b051437e99d86b9c1225768651b2ee9a9209f9041609949dab8aea16ff` · finalize source: fallback

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
- Suggested (1): posthog
- Deferred (0): —

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

Manifest sha256: `sha256:339d6dbcc07038b2684e20b488ec799b34607a18fd57aee55a01c78931ed97c0` · finalize source: fallback

---
## `notion` — B2B/B2C productivity SaaS · all-in-one workspace · freemium PLG with team upsell

**Pillar inputs**
- Pillar 1: Notion · https://www.notion.so
  > Notion is an all-in-one productivity workspace combining notes, docs, project management. Freemium individual + paid team tiers. ~30M users, $10B valuation. Strong PLG motion.
- Pillar 3: product_state=live_paying_customers · stage=10m_plus_arr
- Pillar 4: lead_sources=[product_led_viral, content_seo, referral_word_of_mouth] · sales_motion=self_serve_plg · close_channel=mixed
- Pillar 5: comm_channel=slack · urgency=digest_plus_urgent_phone

**Connectors**
- Required (4): claude-code, supabase, github, slack
- Suggested (2): mixpanel, stripe
- Deferred (4): meta-ads-api, google-ads-api, hubspot, mixpanel

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
| `cmo.demand` | Community Builder | `community-builder` | ✓ ready | cmo |
| `coo` | Coo | `coo` | ✓ ready | ceo.orchestrator |
| `coo.connector` | Composio Integration | `composio-integration` | ✓ ready | coo |
| `coo.credentials` | Composio Integration | `composio-integration` | ✓ ready | coo |
| `coo.dashboard` | Frontend Developer | `frontend-developer` | ✓ ready | coo |
| `coo.health` | Infrastructure Maintainer | `infrastructure-maintainer` | ✓ ready | coo |
| `coo.memory` | Devops Engineer | `devops-engineer` | ✓ ready | coo |
| `coo.observability` | Devops Engineer | `devops-engineer` | ✓ ready | coo |
| `coo.scheduler` | Devops Engineer | `devops-engineer` | ✓ ready | coo |
| `cpo` | Cpo | `cpo` | ✓ ready | ceo.orchestrator |
| `cpo.build` | Backend Architect | `backend-architect` | ✓ ready | cpo |
| `cpo.growth` | Growth Hacker | `growth-hacker` | ✓ ready | cpo |
| `cpo.qa` | Api Tester | `api-tester` | ✓ ready | cpo |
| `cpo.roadmap` | Ux Architect | `ux-architect` | ✓ ready | cpo |
| `cro` | Cro | `cro` | ✓ ready | ceo.orchestrator |
| `cro.close` | Sales Coach | `sales-coach` | ○ pending | cro |
| `cro.demo` | Sales Engineer | `sales-engineer` | ○ pending | cro |
| `cro.expansion` | Sales Coach | `sales-coach` | ✓ ready | cro |
| `cro.outbound` | Sales Coach | `sales-coach` | ○ pending | cro |

Manifest sha256: `sha256:e58648d0d51b4afccc1f6ef760de32fdbb4c5fe700ec11d5078ea81d08f7eca2` · finalize source: fallback

---
## `figma` — B2B SaaS · collaborative design tool · enterprise + PLG · designer-first community

**Pillar inputs**
- Pillar 1: Figma · https://www.figma.com
  > Figma is browser-based collaborative design and prototyping software for product teams. Used by every major tech company. Per-seat licensing, enterprise + free tiers. Strong design community.
- Pillar 3: product_state=live_paying_customers · stage=10m_plus_arr
- Pillar 4: lead_sources=[product_led_viral, content_seo, events] · sales_motion=self_serve_plg · close_channel=mixed
- Pillar 5: comm_channel=slack · urgency=digest_plus_urgent_phone

**Connectors**
- Required (5): claude-code, supabase, github, slack, mixpanel
- Suggested (1): hubspot
- Deferred (2): meta-ads-api, google-ads-api

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
| `cmo.brand` | Content Creator | `content-creator` | ○ pending | cmo |
| `cmo.content` | Content Creator | `content-creator` | ✓ ready | cmo |
| `cmo.demand` | Community Builder | `community-builder` | ✓ ready | cmo |
| `coo` | Coo | `coo` | ✓ ready | ceo.orchestrator |
| `coo.connector` | Composio Integration | `composio-integration` | ✓ ready | coo |
| `coo.credentials` | Composio Integration | `composio-integration` | ✓ ready | coo |
| `coo.dashboard` | Frontend Developer | `frontend-developer` | ✓ ready | coo |
| `coo.health` | Infrastructure Maintainer | `infrastructure-maintainer` | ✓ ready | coo |
| `coo.memory` | Devops Engineer | `devops-engineer` | ✓ ready | coo |
| `coo.observability` | Devops Engineer | `devops-engineer` | ✓ ready | coo |
| `coo.scheduler` | Devops Engineer | `devops-engineer` | ✓ ready | coo |
| `cpo` | Cpo | `cpo` | ✓ ready | ceo.orchestrator |
| `cpo.build` | Backend Architect | `backend-architect` | ✓ ready | cpo |
| `cpo.growth` | Growth Hacker | `growth-hacker` | ✓ ready | cpo |
| `cpo.qa` | Api Tester | `api-tester` | ✓ ready | cpo |
| `cpo.roadmap` | Ux Architect | `ux-architect` | ✓ ready | cpo |
| `cro` | Cro | `cro` | ✓ ready | ceo.orchestrator |
| `cro.close` | Sales Coach | `sales-coach` | ○ pending | cro |
| `cro.demo` | Sales Engineer | `sales-engineer` | ○ pending | cro |
| `cro.expansion` | Sales Coach | `sales-coach` | ✓ ready | cro |
| `cro.outbound` | Sales Coach | `sales-coach` | ○ pending | cro |

Manifest sha256: `sha256:8a34be4404d59370ef4db06e35963e1c37cb52e137328d6c7a01c0ea6b9fd669` · finalize source: fallback

---
## `stripe` — FinTech · payments infrastructure · enterprise sales + self-serve developers · global regulated

**Pillar inputs**
- Pillar 1: Stripe · https://stripe.com
  > Stripe is global payments infrastructure powering online businesses. APIs for accepting payments, managing subscriptions, payouts, fraud. SOC2, PCI-DSS L1, regulated in dozens of jurisdictions.
- Pillar 3: product_state=live_paying_customers · stage=10m_plus_arr
- Pillar 4: lead_sources=[content_seo, outbound_cold, partnerships] · sales_motion=high_touch_enterprise · close_channel=mostly_phone_video
- Pillar 5: comm_channel=slack · urgency=digest_plus_urgent_phone

**Connectors**
- Required (4): claude-code, supabase, slack, github
- Suggested (2): mixpanel, posthog
- Deferred (0): —

**Swarm topology**
- Active: 32 · Standby: 0 · Parked: 2 · Disabled: 0
- Total slots: 34

**Activated fleet (34 rows in DB)**

| Slot | Display | Template | Status | Reports to |
|---|---|---|---|---|
| `cdo` | Cdo | `cdo` | ✓ ready | ceo.orchestrator |
| `cdo.attribute` | Support Analytics | `support-analytics` | ✓ ready | cdo |
| `cdo.infer` | Prompt Engineer | `prompt-engineer` | ✓ ready | cdo |
| `cdo.signal` | Reality Checker | `reality-checker` | ✓ ready | cdo |
| `cdo.telemetry` | Support Analytics | `support-analytics` | ✓ ready | cdo |
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
| `cmo.demand` | Community Builder | `community-builder` | ✓ ready | cmo |
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
| `cpo.roadmap` | Ux Architect | `ux-architect` | ✓ ready | cpo |
| `cro` | Cro | `cro` | ✓ ready | ceo.orchestrator |
| `cro.close` | Sales Coach | `sales-coach` | ✓ ready | cro |
| `cro.demo` | Solutions Architect | `solutions-architect` | ✓ ready | cro |
| `cro.expansion` | Sales Coach | `sales-coach` | ✓ ready | cro |
| `cro.outbound` | Sales Coach | `sales-coach` | ○ pending | cro |

Manifest sha256: `sha256:b9ee5f116176ac7c368dfcf2128c98cc2cfd237c37a27706d68eb0e065409c14` · finalize source: fallback

---
## `ramp` — FinTech · corporate cards + AP automation · CFO-targeted enterprise sales

**Pillar inputs**
- Pillar 1: Ramp · https://ramp.com
  > Ramp is corporate card + spend management + AP automation for finance teams. CFOs are buyers. SOC2 Type 2, integrations with QuickBooks, Netsuite, etc. Aggressive cashback to displace Brex/Amex.
- Pillar 3: product_state=live_paying_customers · stage=10m_plus_arr
- Pillar 4: lead_sources=[outbound_cold, content_seo, partnerships] · sales_motion=high_touch_enterprise · close_channel=mostly_phone_video
- Pillar 5: comm_channel=slack · urgency=digest_plus_urgent_phone

**Connectors**
- Required (5): claude-code, supabase, github, slack, mixpanel
- Suggested (1): stripe
- Deferred (4): linkedin-sales-nav, hubspot, hubspot, mixpanel

**Swarm topology**
- Active: 32 · Standby: 0 · Parked: 2 · Disabled: 0
- Total slots: 34

**Activated fleet (34 rows in DB)**

| Slot | Display | Template | Status | Reports to |
|---|---|---|---|---|
| `cdo` | Cdo | `cdo` | ✓ ready | ceo.orchestrator |
| `cdo.attribute` | Support Analytics | `support-analytics` | ✓ ready | cdo |
| `cdo.infer` | Prompt Engineer | `prompt-engineer` | ✓ ready | cdo |
| `cdo.signal` | Reality Checker | `reality-checker` | ✓ ready | cdo |
| `cdo.telemetry` | Support Analytics | `support-analytics` | ✓ ready | cdo |
| `ceo.orchestrator` | Ceo | `ceo` | ✓ ready | — |
| `cfo` | Cfo | `cfo` | ✓ ready | ceo.orchestrator |
| `cfo.capital` | Financial Analyst | `financial-analyst` | ✓ ready | cfo |
| `cfo.econ` | Financial Analyst | `financial-analyst` | ✓ ready | cfo |
| `cfo.forecast` | Financial Analyst | `financial-analyst` | ✓ ready | cfo |
| `cfo.treasury` | Bookkeeper | `bookkeeper` | ✓ ready | cfo |
| `cmo` | Cmo | `cmo` | ✓ ready | ceo.orchestrator |
| `cmo.advocacy` | Brand Guardian | `brand-guardian` | ○ pending | cmo |
| `cmo.brand` | Brand Guardian | `brand-guardian` | ○ pending | cmo |
| `cmo.content` | Story Architect | `story-architect` | ✓ ready | cmo |
| `cmo.demand` | Community Builder | `community-builder` | ✓ ready | cmo |
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
| `cpo.roadmap` | Ux Architect | `ux-architect` | ✓ ready | cpo |
| `cro` | Cro | `cro` | ✓ ready | ceo.orchestrator |
| `cro.close` | Sales Coach | `sales-coach` | ✓ ready | cro |
| `cro.demo` | Solutions Architect | `solutions-architect` | ✓ ready | cro |
| `cro.expansion` | Sales Coach | `sales-coach` | ✓ ready | cro |
| `cro.outbound` | Sales Coach | `sales-coach` | ✓ ready | cro |

Manifest sha256: `sha256:6fe79cb95e7b81f6c52ed5f60431f069ad3141f4569c6343c21f7c6a320da061` · finalize source: fallback

---
## `posthog` — OSS B2B · product analytics + session replay · self-host or cloud · developer-led

**Pillar inputs**
- Pillar 1: PostHog · https://posthog.com
  > PostHog is open-source product analytics. Self-host or PostHog Cloud. Tracks events, replays sessions, A/B tests, feature flags. Developer-first, MIT-style license. ~$10M ARR, growing fast.
- Pillar 3: product_state=live_paying_customers · stage=5m_10m_arr
- Pillar 4: lead_sources=[content_seo, product_led_viral, events] · sales_motion=self_serve_plg · close_channel=mixed
- Pillar 5: comm_channel=slack · urgency=digest_plus_urgent_phone

**Connectors**
- Required (5): claude-code, supabase, slack, mixpanel, github
- Suggested (1): posthog
- Deferred (0): —

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
| `cdo.telemetry` | Data Engineer | `data-engineer` | ✓ ready | cdo |
| `ceo.orchestrator` | Ceo | `ceo` | ✓ ready | — |
| `cfo` | Cfo | `cfo` | ✓ ready | ceo.orchestrator |
| `cfo.capital` | Financial Analyst | `financial-analyst` | ✓ ready | cfo |
| `cfo.econ` | Financial Analyst | `financial-analyst` | ✓ ready | cfo |
| `cfo.forecast` | Financial Analyst | `financial-analyst` | ✓ ready | cfo |
| `cfo.treasury` | Bookkeeper | `bookkeeper` | ✓ ready | cfo |
| `cmo` | Cmo | `cmo` | ✓ ready | ceo.orchestrator |
| `cmo.advocacy` | Community Builder | `community-builder` | ✓ ready | cmo |
| `cmo.brand` | Ad Creative Strategist | `ad-creative-strategist` | ○ pending | cmo |
| `cmo.content` | Content Creator | `content-creator` | ✓ ready | cmo |
| `cmo.demand` | Community Builder | `community-builder` | ✓ ready | cmo |
| `coo` | Coo | `coo` | ✓ ready | ceo.orchestrator |
| `coo.connector` | Composio Integration | `composio-integration` | ✓ ready | coo |
| `coo.credentials` | Composio Integration | `composio-integration` | ✓ ready | coo |
| `coo.dashboard` | Frontend Developer | `frontend-developer` | ✓ ready | coo |
| `coo.health` | Infrastructure Maintainer | `infrastructure-maintainer` | ✓ ready | coo |
| `coo.memory` | Devops Engineer | `devops-engineer` | ✓ ready | coo |
| `coo.observability` | Devops Engineer | `devops-engineer` | ✓ ready | coo |
| `coo.scheduler` | Devops Engineer | `devops-engineer` | ✓ ready | coo |
| `cpo` | Cpo | `cpo` | ✓ ready | ceo.orchestrator |
| `cpo.build` | Backend Architect | `backend-architect` | ✓ ready | cpo |
| `cpo.growth` | Growth Hacker | `growth-hacker` | ✓ ready | cpo |
| `cpo.qa` | Api Tester | `api-tester` | ✓ ready | cpo |
| `cpo.roadmap` | Ux Architect | `ux-architect` | ✓ ready | cpo |
| `cro` | Cro | `cro` | ✓ ready | ceo.orchestrator |
| `cro.close` | Sales Coach | `sales-coach` | ○ pending | cro |
| `cro.demo` | Sales Engineer | `sales-engineer` | ○ pending | cro |
| `cro.expansion` | Sales Coach | `sales-coach` | ✓ ready | cro |
| `cro.outbound` | Sales Coach | `sales-coach` | ○ pending | cro |

Manifest sha256: `sha256:6e68857b21911168a8bf697ce38c3908aba9529eba453f0a3f2c1ffb28b667f7` · finalize source: fallback

---
## `supabase` — OSS B2B · open-source Firebase alternative · Postgres + auth + storage · cloud + self-host

**Pillar inputs**
- Pillar 1: Supabase · https://supabase.com
  > Supabase is an open-source Firebase alternative — managed Postgres + Auth + Storage + Realtime + Edge Functions. Apache-2 license. Strong indie dev + startup community. Cloud + self-host.
- Pillar 3: product_state=live_paying_customers · stage=10m_plus_arr
- Pillar 4: lead_sources=[content_seo, product_led_viral, events] · sales_motion=self_serve_plg · close_channel=mixed
- Pillar 5: comm_channel=slack · urgency=digest_plus_urgent_phone

**Connectors**
- Required (5): claude-code, supabase, slack, mixpanel, github
- Suggested (1): posthog
- Deferred (0): —

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
| `coo.health` | Infrastructure Maintainer | `infrastructure-maintainer` | ✓ ready | coo |
| `coo.memory` | Devops Engineer | `devops-engineer` | ✓ ready | coo |
| `coo.observability` | Devops Engineer | `devops-engineer` | ✓ ready | coo |
| `coo.scheduler` | Devops Engineer | `devops-engineer` | ✓ ready | coo |
| `cpo` | Cpo | `cpo` | ✓ ready | ceo.orchestrator |
| `cpo.build` | Backend Architect | `backend-architect` | ✓ ready | cpo |
| `cpo.growth` | Growth Hacker | `growth-hacker` | ✓ ready | cpo |
| `cpo.qa` | Api Tester | `api-tester` | ✓ ready | cpo |
| `cpo.roadmap` | Ux Architect | `ux-architect` | ✓ ready | cpo |
| `cro` | Cro | `cro` | ✓ ready | ceo.orchestrator |
| `cro.close` | Sales Coach | `sales-coach` | ○ pending | cro |
| `cro.demo` | Sales Engineer | `sales-engineer` | ○ pending | cro |
| `cro.expansion` | Sales Coach | `sales-coach` | ✓ ready | cro |
| `cro.outbound` | Sales Coach | `sales-coach` | ○ pending | cro |

Manifest sha256: `sha256:cb9fe3e66b8218460b43ecb4b7193b3994665389eb2169de39769ec6c1085c63` · finalize source: fallback

---
## `zapier` — B2B SaaS · no-code integration platform · 6000+ app catalog · prosumer + enterprise

**Pillar inputs**
- Pillar 1: Zapier · https://zapier.com
  > Zapier is a no-code automation platform connecting 6000+ apps. Trigger-action workflows. Used by ops/marketing teams. Freemium individual + team + enterprise tiers. Strong content marketing engine.
- Pillar 3: product_state=live_paying_customers · stage=10m_plus_arr
- Pillar 4: lead_sources=[content_seo, product_led_viral, partnerships] · sales_motion=self_serve_plg · close_channel=mixed
- Pillar 5: comm_channel=slack · urgency=digest_plus_urgent_phone

**Connectors**
- Required (5): claude-code, supabase, github, slack, mixpanel
- Suggested (1): hubspot
- Deferred (0): —

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
| `cmo.demand` | Community Builder | `community-builder` | ✓ ready | cmo |
| `coo` | Coo | `coo` | ✓ ready | ceo.orchestrator |
| `coo.connector` | Composio Integration | `composio-integration` | ✓ ready | coo |
| `coo.credentials` | Composio Integration | `composio-integration` | ✓ ready | coo |
| `coo.dashboard` | Frontend Developer | `frontend-developer` | ✓ ready | coo |
| `coo.health` | Infrastructure Maintainer | `infrastructure-maintainer` | ✓ ready | coo |
| `coo.memory` | Devops Engineer | `devops-engineer` | ✓ ready | coo |
| `coo.observability` | Devops Engineer | `devops-engineer` | ✓ ready | coo |
| `coo.scheduler` | Devops Engineer | `devops-engineer` | ✓ ready | coo |
| `cpo` | Cpo | `cpo` | ✓ ready | ceo.orchestrator |
| `cpo.build` | Backend Architect | `backend-architect` | ✓ ready | cpo |
| `cpo.growth` | Growth Hacker | `growth-hacker` | ✓ ready | cpo |
| `cpo.qa` | Api Tester | `api-tester` | ✓ ready | cpo |
| `cpo.roadmap` | Ux Architect | `ux-architect` | ✓ ready | cpo |
| `cro` | Cro | `cro` | ✓ ready | ceo.orchestrator |
| `cro.close` | Sales Coach | `sales-coach` | ○ pending | cro |
| `cro.demo` | Sales Engineer | `sales-engineer` | ○ pending | cro |
| `cro.expansion` | Sales Coach | `sales-coach` | ✓ ready | cro |
| `cro.outbound` | Sales Coach | `sales-coach` | ○ pending | cro |

Manifest sha256: `sha256:6240635217d9a7dfea00fa3fc1e7582695e71757cc9e1b4dc4bb5f7263e21f43` · finalize source: fallback

---
## `retool` — B2B SaaS · low-code internal tools · enterprise sales · developer + ops buyers

**Pillar inputs**
- Pillar 1: Retool · https://retool.com
  > Retool is a low-code platform for building internal tools — admin panels, dashboards, CRUD apps. Drag-and-drop UI components + JavaScript queries. Sells to engineering + ops teams in mid-market and enterprise.
- Pillar 3: product_state=live_paying_customers · stage=10m_plus_arr
- Pillar 4: lead_sources=[content_seo, outbound_cold, events] · sales_motion=assisted_demo · close_channel=mostly_phone_video
- Pillar 5: comm_channel=slack · urgency=digest_plus_urgent_phone

**Connectors**
- Required (4): claude-code, supabase, github, slack
- Suggested (2): mixpanel, hubspot
- Deferred (0): —

**Swarm topology**
- Active: 31 · Standby: 0 · Parked: 3 · Disabled: 0
- Total slots: 34

**Activated fleet (34 rows in DB)**

| Slot | Display | Template | Status | Reports to |
|---|---|---|---|---|
| `cdo` | Cdo | `cdo` | ✓ ready | ceo.orchestrator |
| `cdo.attribute` | Support Analytics | `support-analytics` | ✓ ready | cdo |
| `cdo.infer` | Ai Engineer | `ai-engineer` | ✓ ready | cdo |
| `cdo.signal` | Mlops Engineer | `mlops-engineer` | ✓ ready | cdo |
| `cdo.telemetry` | Support Analytics | `support-analytics` | ✓ ready | cdo |
| `ceo.orchestrator` | Ceo | `ceo` | ✓ ready | — |
| `cfo` | Cfo | `cfo` | ✓ ready | ceo.orchestrator |
| `cfo.capital` | Financial Analyst | `financial-analyst` | ✓ ready | cfo |
| `cfo.econ` | Financial Analyst | `financial-analyst` | ✓ ready | cfo |
| `cfo.forecast` | Financial Analyst | `financial-analyst` | ✓ ready | cfo |
| `cfo.treasury` | Bookkeeper | `bookkeeper` | ✓ ready | cfo |
| `cmo` | Cmo | `cmo` | ✓ ready | ceo.orchestrator |
| `cmo.advocacy` | Brand Guardian | `brand-guardian` | ○ pending | cmo |
| `cmo.brand` | Brand Guardian | `brand-guardian` | ○ pending | cmo |
| `cmo.content` | Content Creator | `content-creator` | ✓ ready | cmo |
| `cmo.demand` | Growth Hacker | `growth-hacker` | ✓ ready | cmo |
| `coo` | Coo | `coo` | ✓ ready | ceo.orchestrator |
| `coo.connector` | Composio Integration | `composio-integration` | ✓ ready | coo |
| `coo.credentials` | Composio Integration | `composio-integration` | ✓ ready | coo |
| `coo.dashboard` | Frontend Developer | `frontend-developer` | ✓ ready | coo |
| `coo.health` | Incident Responder | `incident-responder` | ✓ ready | coo |
| `coo.memory` | Devops Engineer | `devops-engineer` | ✓ ready | coo |
| `coo.observability` | Devops Engineer | `devops-engineer` | ✓ ready | coo |
| `coo.scheduler` | Devops Engineer | `devops-engineer` | ✓ ready | coo |
| `cpo` | Cpo | `cpo` | ✓ ready | ceo.orchestrator |
| `cpo.build` | Backend Architect | `backend-architect` | ✓ ready | cpo |
| `cpo.growth` | Growth Hacker | `growth-hacker` | ✓ ready | cpo |
| `cpo.qa` | Api Tester | `api-tester` | ✓ ready | cpo |
| `cpo.roadmap` | Product Manager | `product-manager` | ✓ ready | cpo |
| `cro` | Cro | `cro` | ✓ ready | ceo.orchestrator |
| `cro.close` | Sales Coach | `sales-coach` | ✓ ready | cro |
| `cro.demo` | Sales Engineer | `sales-engineer` | ✓ ready | cro |
| `cro.expansion` | Sales Coach | `sales-coach` | ✓ ready | cro |
| `cro.outbound` | Sales Coach | `sales-coach` | ○ pending | cro |

Manifest sha256: `sha256:fa874a88817100c8089ead78c0b2c62fc5a659dc975575837aa7a2a1bb26c8a7` · finalize source: fallback

---
## `peloton` — Hardware + content · connected fitness · DTC consumer · subscription + bike/tread sales

**Pillar inputs**
- Pillar 1: Peloton · https://www.onepeloton.com
  > Peloton is connected fitness — Bike, Tread, app subscriptions. Hardware + monthly digital content subscription. DTC consumer brand. Influencer partnerships, paid ads, retail partnerships. Public company.
- Pillar 3: product_state=live_paying_customers · stage=10m_plus_arr
- Pillar 4: lead_sources=[inbound_ads_meta_google, partnerships, referral_word_of_mouth] · sales_motion=self_serve_plg · close_channel=mixed
- Pillar 5: comm_channel=slack · urgency=digest_plus_urgent_phone

**Connectors**
- Required (6): claude-code, supabase, github, slack, shopify, stripe
- Suggested (4): meta-ads-api, google-ads-api, mixpanel, klaviyo
- Deferred (1): shipstation

**Swarm topology**
- Active: 29 · Standby: 0 · Parked: 5 · Disabled: 0
- Total slots: 34

**Activated fleet (34 rows in DB)**

| Slot | Display | Template | Status | Reports to |
|---|---|---|---|---|
| `cdo` | Cdo | `cdo` | ✓ ready | ceo.orchestrator |
| `cdo.attribute` | Growth Experiment Designer | `growth-experiment-designer` | ✓ ready | cdo |
| `cdo.infer` | Image Prompt Engineer | `image-prompt-engineer` | ✓ ready | cdo |
| `cdo.signal` | Ai Engineer | `ai-engineer` | ✓ ready | cdo |
| `cdo.telemetry` | Analytics Reporter | `analytics-reporter` | ✓ ready | cdo |
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
| `coo.dashboard` | Ui Designer | `ui-designer` | ✓ ready | coo |
| `coo.health` | Infrastructure Maintainer | `infrastructure-maintainer` | ✓ ready | coo |
| `coo.memory` | Feedback Synthesizer | `feedback-synthesizer` | ✓ ready | coo |
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

Manifest sha256: `sha256:563a8c75844358fe5134d93497f522815192f70742eda52af76ce5bebe0fb98c` · finalize source: fallback

---
## `duolingo` — Consumer EdTech · gamified language learning · freemium + Duolingo Plus · viral growth

**Pillar inputs**
- Pillar 1: Duolingo · https://www.duolingo.com
  > Duolingo is gamified language learning. Freemium app with Super Duolingo subscription + Duolingo English Test certification. ~80M monthly users. Public company. Strong viral mechanics + push notification game.
- Pillar 3: product_state=live_paying_customers · stage=10m_plus_arr
- Pillar 4: lead_sources=[product_led_viral, inbound_ads_meta_google, content_seo] · sales_motion=self_serve_plg · close_channel=mixed
- Pillar 5: comm_channel=slack · urgency=digest_plus_urgent_phone

**Connectors**
- Required (5): claude-code, supabase, github, slack, mixpanel
- Suggested (3): meta-ads-api, google-ads-api, stripe
- Deferred (2): hubspot, mixpanel

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
| `cmo.brand` | Content Creator | `content-creator` | ○ pending | cmo |
| `cmo.content` | Content Creator | `content-creator` | ✓ ready | cmo |
| `cmo.demand` | Community Builder | `community-builder` | ✓ ready | cmo |
| `coo` | Coo | `coo` | ✓ ready | ceo.orchestrator |
| `coo.connector` | Composio Integration | `composio-integration` | ✓ ready | coo |
| `coo.credentials` | Composio Integration | `composio-integration` | ✓ ready | coo |
| `coo.dashboard` | Analytics Reporter | `analytics-reporter` | ✓ ready | coo |
| `coo.health` | Infrastructure Maintainer | `infrastructure-maintainer` | ✓ ready | coo |
| `coo.memory` | Devops Engineer | `devops-engineer` | ✓ ready | coo |
| `coo.observability` | Analytics Reporter | `analytics-reporter` | ✓ ready | coo |
| `coo.scheduler` | Devops Engineer | `devops-engineer` | ✓ ready | coo |
| `cpo` | Cpo | `cpo` | ✓ ready | ceo.orchestrator |
| `cpo.build` | Backend Architect | `backend-architect` | ✓ ready | cpo |
| `cpo.growth` | Growth Hacker | `growth-hacker` | ✓ ready | cpo |
| `cpo.qa` | Accessibility Auditor | `accessibility-auditor` | ✓ ready | cpo |
| `cpo.roadmap` | Ux Architect | `ux-architect` | ✓ ready | cpo |
| `cro` | Cro | `cro` | ✓ ready | ceo.orchestrator |
| `cro.close` | Sales Coach | `sales-coach` | ○ pending | cro |
| `cro.demo` | Sales Engineer | `sales-engineer` | ○ pending | cro |
| `cro.expansion` | Sales Coach | `sales-coach` | ✓ ready | cro |
| `cro.outbound` | Sales Coach | `sales-coach` | ○ pending | cro |

Manifest sha256: `sha256:813dea58149b3f764b7a140a579d0bc7e31c529a3c54a473768f85dde65fc5ea` · finalize source: fallback
