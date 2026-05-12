# Error recovery triage

**Purpose:** Classify a cluster of failed agent runs into one of four buckets so the right recovery action fires (per capture B §3 — three-layer recovery pattern).

**Caller:** Pool C cron in `supabase/functions/optimizer-build-injection/` (lands in F.5). Also callable as a one-off via the Meta Mission Control dashboard.

**Pool:** C — WaveX-paid, gated on Growth+ subscription.

**Model:** Sonnet 4.6. Classification + brief recommendation; needs nuance Haiku can miss.

## Inputs

| Variable | Description | Source |
|---|---|---|
| `{{FLEET_DIGEST_JSON}}` | The customer's most recent fleet digest (issue list + agent status + error log) | `wavex_os.fleet_digests` |
| `{{ERRORS_WINDOW_HOURS}}` | How far back to look for failures | typically 24 |
| `{{FLEET_ROSTER}}` | List of agent roles + slot names | `swarm_manifest.agents` |

## Output schema

```jsonc
{
  "cluster_classification": "string — one of: adapter_drift | harness_regression | KPI_definition_error | environmental | unclear",
  "evidence": [
    "string — quoted snippets from the digest (issue keys + 1-line description)"
  ],
  "affected_agents": ["string — slot names"],
  "recommended_action": {
    "kind": "string — one of: comment | new_issue | pause_agent | escalate_to_operator",
    "target": "string — slot name OR 'all'",
    "body": "string — Markdown body of the comment/issue to be posted, ≤1500 chars"
  },
  "confidence": "number 0-1",
  "operator_alert_required": "boolean — true if confidence < 0.6 OR classification = 'unclear'"
}
```

## The four buckets

Per capture B §3:

- **adapter_drift** — same agent, same error category, repeated. The agent's adapter config has drifted (OAuth expired, model unavailable, env var missing). Action: post a comment on the agent's most recent failed run telling the operator to check the adapter; the System Reliability agent may auto-pause if it's an OAuth refresh failure.
- **harness_regression** — different agents, same error category. A platform-level change broke something common (wrapper script regression, Paperclip update bug). Action: create a `priority='high'` issue tagged `harness-regression` and assign to the operator (HUMAN-ESCALATION).
- **KPI_definition_error** — agents are reading a KPI query that returns NULL or 0 incorrectly, then filing recovery issues. Action: comment on the relevant agent's last run pointing at the structural-zero detection rule (`SKILL_KPI_OWNERSHIP.md` — structural vs measured zero).
- **environmental** — the host itself is degraded (disk pressure, RAM swap, network). Action: defer to the System Reliability agent — file a comment pointing at the resource-sweep log, do not propose a code fix.
- **unclear** — confidence < 0.6 across all four buckets. Action: escalate to operator with the evidence list.

## Prompt body

```
You are triaging a cluster of failed agent runs in a customer's local
WaveX OS fleet. Your job is to classify the cluster into ONE of the
four documented buckets and recommend ONE action.

Fleet digest (last {{ERRORS_WINDOW_HOURS}}h):

{{FLEET_DIGEST_JSON}}

Operating fleet roster:
{{FLEET_ROSTER}}

The four buckets:

1. adapter_drift — same single agent has ≥3 failures of the same kind
   in the window. Likely cause: OAuth token expired, model name changed,
   wrapper script env var missing, claude CLI not on PATH.

2. harness_regression — ≥2 different agents fail with the SAME error
   signature (matching stack trace or error class). Likely cause: a
   platform-level change broke something common (Paperclip update, wavex
   wrapper script regression).

3. KPI_definition_error — agents are filing recovery/blocked issues that
   reference a KPI value of 0 or NULL, but the agent itself has no error
   in its run output. Likely cause: structural-zero misclassification
   (the KPI's writer isn't wired yet, so 0 means "ingestion pending",
   not "measured zero").

4. environmental — multiple agents fail with disk/RAM/network signatures.
   Defer to the System Reliability agent.

Decision rules:
- If you see 1 agent fail ≥3 times same error → adapter_drift.
- If you see ≥2 agents fail with same signature → harness_regression.
- If failure messages mention "0 results" "NULL value" "no data" but no
  code error → KPI_definition_error.
- If failure messages mention "ENOSPC" "out of memory" "cannot connect"
  "timeout against localhost" → environmental.
- If you cannot fit the cluster cleanly into ONE bucket with ≥0.6
  confidence → unclear, escalate to operator.

Recommended action format:
- adapter_drift → kind=comment, target=offending_agent_slot, body=
  "Adapter drift detected: <evidence>. Operator should check OAuth/env."
- harness_regression → kind=new_issue, target=operator, priority=high,
  body=quote signatures + list affected agents.
- KPI_definition_error → kind=comment, target=offending_agent_slot,
  body=reference SKILL_KPI_OWNERSHIP structural-zero section.
- environmental → kind=comment, target=system-reliability slot,
  body=quote signatures.
- unclear → kind=escalate_to_operator, target=operator, body=evidence
  list + ask which bucket fits.

Be conservative with confidence. If you're guessing, set < 0.6 and
escalate.

Return ONLY the JSON object.
```

## Failure mode + fallback

If the LLM call fails: the optimizer cron logs the failure to `wavex_os.optimizer_runs` with `status='error'` and skips this cluster. The cluster will be re-evaluated on the next cron tick. No injection is delivered to the customer's Liaison.

The customer's fleet continues operating normally (Pool C being unavailable does not stop Pool B — the customer's local agents). Mission Control on the customer's box shows "Optimizer: connecting…" per V2_CAPTURE_C §5.

## Cost budget

Per capture C §6, daily cost cap per tier:
- Founder: 40K tokens/day → this prompt at ~5K tokens fits 8× per day. Each daily run analyzes the prior 24h.
- Growth: 140K tokens/day → 28× per day. Probably 4-6 runs spread across business hours.
- Custom: 420K tokens/day → effectively unbounded for this prompt.
