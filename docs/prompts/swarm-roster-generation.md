# Swarm roster generation — pick the right C-Suite shape from 165 templates

**Purpose:** Given Pillar 1-4 answers, output a swarm manifest specifying which slots get filled, which template per slot, and the reports-to chain.

**Caller:** `vendor/wavex-os/onboarding/src/phases/phase-3-swarm/decision-matrix.ts`

**Pool:** A — onboarding T2.

**Model:** Sonnet 4.6. This is the highest-stakes T2 call in the wizard — the roster determines everything downstream. Worth Sonnet's cost.

## Inputs

| Variable | Description | Source |
|---|---|---|
| `{{PILLAR_1}}` | Full Pillar 1 enrichment JSON | pillar_responses |
| `{{PILLAR_3_STAGE}}` | Operator's stage answer | pillar_responses |
| `{{PILLAR_4_GTM}}` | GTM motion + acquisition channels | pillar_responses |
| `{{HEADCOUNT}}` | Operator's headcount answer | pillar_responses |
| `{{AVAILABLE_TEMPLATES}}` | Full list of 165 templates with slot+matrix metadata | agent-templates registry |

## Output schema

```jsonc
{
  "roster_shape": "string — one of: minimal_kernel | collapsed_6 | hybrid | formal_9",
  "agents": [
    {
      "slot": "string — slot name like 'ceo.orchestrator', 'cmo.demand', etc.",
      "template_id": "string — must exist in AVAILABLE_TEMPLATES",
      "reports_to_slot": "string|null — null only for ceo.orchestrator",
      "confidence_level": "number — 1 (read-only) to 3 (autonomous)",
      "rationale": "string ≤120 chars — why this template for this slot at this stage"
    }
  ],
  "collapsed_role_map": { "MarketingOps": ["cmo", "cro"], ... } | null
}
```

## Prompt body

```
You are picking the right swarm roster for a new WaveX OS company. This
is the single most consequential decision in onboarding — get it wrong
and the operator inherits a 9-agent fleet they don't need (overhead) or
a 4-agent fleet that can't serve their stage (under-served).

Pillar 1 (who you are):
{{PILLAR_1}}

Stage (Pillar 3): {{PILLAR_3_STAGE}}
GTM motion (Pillar 4): {{PILLAR_4_GTM}}
Headcount: {{HEADCOUNT}}

Available templates (slot, template_id, stage_fit, gtm_fit):
{{AVAILABLE_TEMPLATES}}

Hard rules from SKILL_ROLE_COLLAPSE:

| Stage / headcount | Roster shape | Agents |
|---|---|---|
| pre_product OR headcount=1 below 100k_mrr | minimal_kernel | 4-5 |
| live_no_paying OR live_paying < 100k_mrr | collapsed_6 | ~12 |
| 10k_100k_mrr | hybrid | 7-8 |
| 100k_mrr_plus | formal_9 | 33+ |

Collapse map (when applicable):
- MarketingOps = CMO + CRO (one agent absorbs both)
- FullStackEngineer = CTO + CPO
- RecoveryEngineer = COO + CDO partial

The kernel (CEO + CoS) is NEVER collapsed.

Decision rules:
1. Start by choosing roster_shape from the stage table above.
2. For each slot in the chosen shape, pick the template whose stage_fit
   AND gtm_fit BOTH match. If only stage_fit matches: use that template
   anyway, set confidence_level=2 (default 3), and flag the gtm mismatch
   in rationale.
3. confidence_level defaults to 3 (autonomous). Drop to 2 (read-mostly)
   for any agent whose template_id has stage_fit='generic' (a fallback
   rather than a precise fit). The CoS gets confidence 3 always (it
   needs to write graded comments). CEO gets confidence 3 always.
4. reports_to_slot must form a tree rooted at ceo.orchestrator. Each
   non-CEO agent reports to exactly one other slot. Specialist slots
   (cmo.demand, cmo.content, etc.) report to the chief of their lane
   (cmo) which reports to ceo.orchestrator.
5. ALWAYS include the System Reliability agent (slot=system-reliability)
   in every roster shape. It is the new mandatory operator. Reports to
   ceo.orchestrator. confidence_level=2.

Edge case — headcount=1 (solo founder):
- Force roster_shape=minimal_kernel regardless of stage (unless stage is
  100k_mrr_plus). Even at $10K MRR, a solo founder can't manage 12 agents.
- Roster: ceo.orchestrator, ceo.chief-of-staff, marketing-ops,
  full-stack-engineer, recovery-engineer, system-reliability. That's it.

Return ONLY the JSON object.
```

## Failure mode + fallback

If the LLM call fails: wizard falls back to a deterministic decision-matrix tree based purely on the stage answer (no LLM). Deterministic version produces the right roster_shape every time but with less nuance in template_id selection — it picks the first template per slot that matches stage_fit, no GTM cross-check.

The deterministic version is the V1 behavior (already shipped in `vendor/wavex-os/onboarding/src/phases/phase-3-swarm/decision-matrix.ts`). The LLM call is an enhancement that adds GTM-fit selection on top.

## Why this prompt is bigger than ignition-kickoff

ignition-kickoff is a one-sentence rephrasing. swarm-roster-generation is a real decision with downstream effects on every cycle for the company's lifetime. Worth the larger token budget + Sonnet model.
