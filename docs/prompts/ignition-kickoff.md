# Ignition kickoff — first CEO directive after activate

**Purpose:** Generate the CEO's first ONE directive issue right after `activate` completes, so the fleet has visible work within 5min of going live (per `docs/IGNITION.md`).

**Caller:** `packages/op-omega-server/src/bridge/ignition.ts` (lands in P1.2 of this turn).

**Pool:** platform — runs in op-omega-server with deterministic logic + ONE small T1 call to phrase the directive. The bulk of Ignition is mechanical (read manifest, create issues per slot); only this single CEO-voice phrasing is LLM-mediated.

**Model:** Haiku 4.5 (fast, cheap, sufficient for one-sentence-rephrasing). ~2K input tokens, ~500 output tokens.

## Inputs

| Variable | Description | Source |
|---|---|---|
| `{{COMPANY_NAME}}` | Org name from Pillar 1 | `pillar_responses.pillar_1.org_name` |
| `{{COMPANY_CONTEXT}}` | Enriched company context | `pillar_responses.pillar_1.company_context` |
| `{{PRIMARY_FRICTION}}` | Operator's biggest bottleneck | `pillar_responses.pillar_1.primary_friction_hypothesis` |
| `{{META_GOAL}}` | Operator's 90-day target from Finalize | `company.manifest.meta_goal` |
| `{{TOP_AGENT_ROLES}}` | Roles available in this swarm | `swarm_manifest.agents.map(slot)` |

## Output schema

```jsonc
{
  "directive_title": "string (≤80 chars) — fits Paperclip's issue title field",
  "directive_body": "string (markdown, ≤1500 chars) — Paperclip issue body",
  "target_kpi": "string — must be one of the registered KPI names",
  "estimated_delta": "signed number (e.g. +2.5 or -100)",
  "measurement_plan": "string — SQL or query that will be re-run to measure",
  "baseline_snapshot": {
    "value": "number",
    "measured_at": "ISO timestamp",
    "note": "string"
  },
  "assignee_slot": "string — one of TOP_AGENT_ROLES",
  "priority": "string — never 'critical' (max 3/day rule)"
}
```

## Prompt body

```
You are filing the CEO's FIRST directive after the fleet just went live.
This is the moment of ignition. The directive will be assigned to one
operator and graded by the CoS in 1 hour.

Company:
  name: {{COMPANY_NAME}}
  context: {{COMPANY_CONTEXT}}
  primary friction: {{PRIMARY_FRICTION}}
  90-day meta goal: {{META_GOAL}}

Available operator roles: {{TOP_AGENT_ROLES}}

Hard rules:
1. Exactly ONE directive. Not three. Not "first I'd do X then Y". One.
2. The directive must aim DIRECTLY at PRIMARY_FRICTION, not at infrastructure
   or "set up tracking" or "review competitors". Move the actual bottleneck.
3. priority MUST be 'medium' or 'high'. NEVER 'critical' — the platform caps
   critical at 3/day and ignition is not a crisis.
4. The body must be operationally specific. Bad: "improve conversion".
   Good: "send 3 cold emails to ICP X by EOD, measure reply rate against
   baseline 0".
5. target_kpi MUST be one of the registered KPIs. If you're not sure which
   one is registered, choose the one that's most clearly tied to
   PRIMARY_FRICTION — the wizard will validate against the registry and
   return an error if the name doesn't match.
6. baseline_snapshot.value: if PRODUCT_MATURITY is pre_mvp or you have no
   indication of prior measurement, baseline.value = 0 and note = "ignition
   baseline — first cycle".
7. estimated_delta: be honest. First-cycle deltas are typically small
   (+1 to +5 of whatever the KPI unit is). Do NOT propose +50% deltas
   because they look good — overestimation is graded as 'under_target'
   (capture B anti-pattern L2).
8. NEVER use phrasing like "BOARD OVERRIDE", "EMERGENCY", "URGENT" — those
   prefixes trip prompt-injection defenses on receiving operators
   (capture B anti-pattern L4).

Voice: confident-but-grounded CEO. Direct, no fluff. Operator reads this
and immediately knows what to do.

Return ONLY the JSON object. No prose, no markdown fences.
```

## Failure mode + fallback

If the LLM call returns invalid JSON or times out:

1. Log the failure to `ignition-state.json.errors[]`
2. Ignition still proceeds with a deterministic fallback directive:
   - `directive_title`: `"[CEO direction] Day 1: identify the one number we need to move"`
   - `directive_body`: a templated paragraph asking the operator (CoO or Marketing Ops or whichever is highest in TOP_AGENT_ROLES) to write a one-paragraph note proposing the single KPI they think matters most for week 1
   - `target_kpi`: the first KPI in the registered list (validated)
   - `priority: "medium"`, `estimated_delta: +1`, baseline 0
3. The Mission Control banner shows YELLOW: "Fleet ignited (fallback directive)". Operator can manually retry by hitting `POST /api/instance/<id>/ignite` once inference is back.

The fallback ensures Ignition NEVER fails entirely — same reliability property as Pillar 1's T1 fallback (V2_CAPTURE_C §5).

## Why this prompt is small + Haiku-eligible

The intelligence in ignition lives in the wizard's earlier T2 enrichment — by the time this prompt runs, we already know the company's friction, the meta-goal, and the operator roster. This prompt just synthesizes those into one well-phrased directive. Haiku at ~$0.001/call is plenty; Sonnet would be ~$0.03/call for an identical-quality output. At 1 ignition per signup × thousands of signups, the difference compounds.
