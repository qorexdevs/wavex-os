# Fixture Battery — 1 variants

Generated: 2026-05-10T00:41:38.547Z
Mode: skipInference (T0 fast)

## Cross-fixture summary

| Tag | Industry shape | Required | Suggested | Active | Standby | Parked | Disabled |
|---|---|---|---|---|---|---|---|
| **pulse** | Pre-product · AI fitness coaching for solo trainers · idea_o… | 3 | 1 | 20 | 0 | 13 | 1 |

## Per-slot template selection across all fixtures

| Slot | pulse |
|---|---|
| `cdo` | ✓ cdo |
| `cdo.attribute` | ○ support-analytics |
| `cdo.infer` | ✓ ai-engineer |
| `cdo.signal` | ✓ ai-engineer |
| `cdo.telemetry` | ✓ support-analytics |
| `ceo.orchestrator` | ✓ ceo |
| `cfo` | ✓ cfo |
| `cfo.capital` | ✓ financial-analyst |
| `cfo.econ` | ✗ financial-analyst |
| `cfo.forecast` | ○ financial-analyst |
| `cfo.treasury` | ○ bookkeeper |
| `cmo` | ✓ cmo |
| `cmo.advocacy` | ○ content-creator |
| `cmo.brand` | ✓ ad-creative-strategist |
| `cmo.content` | ○ content-creator |
| `cmo.demand` | ○ growth-hacker |
| `coo` | ✓ coo |
| `coo.connector` | ✓ composio-integration |
| `coo.credentials` | ✓ composio-integration |
| `coo.dashboard` | ○ frontend-developer |
| `coo.health` | ✓ recovery-engineer |
| `coo.memory` | ✓ devops-engineer |
| `coo.observability` | ✓ devops-engineer |
| `coo.scheduler` | ✓ devops-engineer |
| `cpo` | ✓ cpo |
| `cpo.build` | ✓ backend-architect |
| `cpo.growth` | ○ growth-hacker |
| `cpo.qa` | ○ accessibility-auditor |
| `cpo.roadmap` | ✓ product-manager |
| `cro` | ✓ cro |
| `cro.close` | ○ sales-coach |
| `cro.demo` | ○ sales-engineer |
| `cro.expansion` | ○ sales-coach |
| `cro.outbound` | ○ sales-coach |

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
| `cmo.advocacy` | Content Creator | `content-creator` | ○ pending | cmo |
| `cmo.brand` | Ad Creative Strategist | `ad-creative-strategist` | ✓ ready | cmo |
| `cmo.content` | Content Creator | `content-creator` | ○ pending | cmo |
| `cmo.demand` | Growth Hacker | `growth-hacker` | ○ pending | cmo |
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
| `cpo.qa` | Accessibility Auditor | `accessibility-auditor` | ○ pending | cpo |
| `cpo.roadmap` | Product Manager | `product-manager` | ✓ ready | cpo |
| `cro` | Cro | `cro` | ✓ ready | ceo.orchestrator |
| `cro.close` | Sales Coach | `sales-coach` | ○ pending | cro |
| `cro.demo` | Sales Engineer | `sales-engineer` | ○ pending | cro |
| `cro.expansion` | Sales Coach | `sales-coach` | ○ pending | cro |
| `cro.outbound` | Sales Coach | `sales-coach` | ○ pending | cro |

Manifest sha256: `sha256:6f90a0b70f9cd7a708376dc5e00b2169db5ca6e3b649297ecdab599e2c51cadd` · finalize source: fallback
