# Board escalation classifier

**Purpose:** When the operator sends a Telegram message to the WaveX bot, classify it into one of: directive (file an issue), question (answer inline), noise (acknowledge but don't act).

**Caller:** `packages/op-omega-server/src/routes/pillar5-test-send.ts` + future Telegram-bridge worker.

**Pool:** platform — small T1 call (~1K input, ~500 output). The classification matters more than the prose; Haiku is sufficient.

**Model:** Haiku 4.5.

## Inputs

| Variable | Description | Source |
|---|---|---|
| `{{TELEGRAM_MESSAGE}}` | Raw message text from operator | Telegram webhook |
| `{{CONTEXT_LAST_3_MSGS}}` | The last 3 messages in this chat (for thread context) | Telegram history |
| `{{FLEET_ROSTER}}` | Roles currently on the fleet | swarm_manifest |
| `{{ACTIVE_KPIS}}` | List of registered KPI names | kpi_registry |

## Output schema

```jsonc
{
  "classification": "string — one of: directive | question | noise | escalation",
  "confidence": "number 0-1",
  "if_directive": {
    "target_role": "string — slot name from FLEET_ROSTER",
    "target_kpi": "string — KPI name from ACTIVE_KPIS",
    "title_draft": "string ≤80 chars",
    "body_draft": "string ≤1000 chars",
    "priority": "string — high|medium|low"
  } | null,
  "if_question": {
    "answer_inline": "string — direct answer ≤500 chars, no fluff"
  } | null,
  "if_escalation": {
    "reason": "string — why this can't be handled automatically",
    "suggested_next_step": "string"
  } | null
}
```

## Prompt body

```
Operator sent a Telegram message to the WaveX bot. Classify it into one
of four categories and produce the right structured output.

Message:
"{{TELEGRAM_MESSAGE}}"

Last 3 messages in this chat (oldest first):
{{CONTEXT_LAST_3_MSGS}}

Fleet roster (roles available to assign work to):
{{FLEET_ROSTER}}

Active KPIs (legitimate target_kpi values):
{{ACTIVE_KPIS}}

The four categories:

1. directive — operator is telling the fleet to DO something specific.
   Examples: "have CMO send the launch email today", "investigate why
   booking_gmv is flat", "pause the QA browser for an hour".
   Output: if_directive populated. target_role MUST be in FLEET_ROSTER.
   target_kpi MUST be in ACTIVE_KPIS (or null only if the directive is
   genuinely meta — e.g. "pause everything").

2. question — operator is asking the fleet a question; no work needs to
   be filed. Examples: "what's our MRR right now?", "did CMO finish the
   campaign?", "is the fleet healthy?".
   Output: if_question populated. Answer from the digest if available;
   if you don't have data, answer "I'll need to check — give me 30s"
   and set classification=question + a follow-up directive.

3. noise — operator says hi, thanks, comments without action requested.
   Examples: "👍", "ok thanks", "lol", "morning".
   Output: classification=noise, no other fields. The Telegram bridge
   will react with 👀 and move on.

4. escalation — operator is upset, confused, or requesting something
   the fleet can't do (legal/financial decision, hiring a human, "shut
   it all down"). Examples: "this is broken, fix it", "why are agents
   spamming me", "stop everything for now".
   Output: classification=escalation, if_escalation populated. The
   Telegram bridge will page the operator's actual contact (if
   configured) or just stop responding.

Decision rules:
- Default to question if intent is unclear — questions are safe, false
  directives create work.
- If operator uses "OVERRIDE", "FORCE", "EMERGENCY", "STOP EVERYTHING"
  → classification=escalation, NOT directive. (capture B anti-pattern L4)
- If confidence < 0.7 on directive → re-classify as question and let
  the operator confirm.
- NEVER set priority='critical' for an inferred directive. Operator
  must explicitly say "critical" or "stop the line" — otherwise default
  high or medium.

Return ONLY the JSON object.
```

## Failure mode + fallback

If the LLM call fails, the Telegram bridge replies with:
> "I got your message but my classifier is down. Could you say which of these you meant — A) please do X, B) please tell me Y, C) just acknowledging?"

This buys ~30s for retry without ever silently dropping operator input. Silent drops on board messages are a P0 trust violation; the explicit "I'm down" response is a P2 UX papercut.

## Why this isn't an agent skill

The classifier runs in the platform layer (`op-omega-server`), not as an agent's heartbeat output, because:

1. **Latency.** Operator expects a reply within seconds. Agent heartbeats are minute-scale.
2. **Determinism.** The four categories are platform contract; agents shouldn't be able to redefine them.
3. **Cost predictability.** One Haiku call per message vs spinning up a Sonnet agent for every Telegram ping.
