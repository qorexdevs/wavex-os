# CEO Lesson Logging — cross-run agent memory

When you grade an issue (`ceo_review_status` = `null_impact`, `regression`, or `unmeasurable` for an issue that SHOULD have been measurable), you must also write a row to `agent_lessons` so the operator's NEXT run reads it.

## Why
Agents forget between runs. Bigger context windows don't help when the agent never sees the prior failure. Lessons are short, durable, and re-injected into operator prompts on wake.

## When to log a lesson

| Situation | severity | example lesson |
|---|---|---|
| Operator filed an issue with null KPI columns (now blocked by trigger but worth catching humans bypassing it) | warning | "Always use create-issue.mjs; never inline INSERT INTO issues." |
| `null_impact` grade — work was done but moved no metric | warning | "REV-3 audit found UTM gap but didn't measure baseline; future audits must snapshot the metric BEFORE the change." |
| `regression` — KPI moved the wrong way | critical | "Bulk cancellations on 2026-04-24 erased 5 intents and reduced confirm pool. Never cancel without a reason code." |
| Operator delivered effort but no measurable hand-off | warning | "Concierge drafts must include the conv_id list so CEO can verify which conversations were touched." |
| Strong delivery worth reinforcing | info | "REV-1 outreach used personalized opening + verified price + booking link template — replicate." |

## How

```bash
PGPASSWORD=paperclip psql -h localhost -p 54329 -U paperclip -d paperclip -c "
  INSERT INTO agent_lessons (company_id, agent_id, issue_id, lesson, severity, expires_at)
  VALUES (
    '<COMPANY_ID>',
    (SELECT id FROM agents WHERE name='<operator name>'),
    (SELECT id FROM issues WHERE identifier='<WAV-####>'),
    '<one-line lesson, present tense, imperative>',
    '<info|warning|critical>',
    NOW() + INTERVAL '30 days'
  );
"
```

Or via the Bash tool with the same SQL piped through node + the embedded pg.

## Lesson hygiene
- Keep each lesson **under 200 chars**.
- Present tense, imperative voice ("Always X" / "Never Y" / "Replicate Z").
- Set `expires_at` 30 days out so old lessons don't crowd the prompt.
- One lesson per failure mode — don't write three lessons that all say "use the tool."

## Operator-side
The operator wake-up loader injects the **5 most recent unexpired lessons** for that operator's agent_id into the system prompt as:
```
## Lessons from prior runs (read before acting)
- [warning, 3d ago] Always use create-issue.mjs; never inline INSERT INTO issues.
- [info, 1d ago] REV-1 outreach used personalized opening + verified price...
```
This is the actual cross-run memory — durable, queryable, scoped per agent, auto-expiring.
