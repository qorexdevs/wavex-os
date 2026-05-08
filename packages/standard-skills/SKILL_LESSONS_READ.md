# SKILL_LESSONS_READ — pre-flight: read your lessons before acting

**Audience:** every agent in a WaveX OS fleet.

Every wake, your FIRST tool call (before any work) must retrieve any lessons logged on you from prior runs.

## What to query

```
SELECT severity, lesson, created_at
FROM agent_lessons
WHERE company_id = $COMPANY_ID
  AND agent_id = (SELECT id FROM agents WHERE name = $YOUR_AGENT_NAME)
  AND (expires_at IS NULL OR expires_at > NOW())
ORDER BY created_at DESC
LIMIT 5;
```

How you execute that query depends on the adapter you ship with:

- If you have a database MCP tool, use it (preferred — credentials never leak into your context).
- Otherwise, the orchestrator exposes a CLI helper at `<paperclip-root>/tools/lessons-read.mjs <agent-name>` that returns a JSON array.
- **Never** hardcode database credentials into your skill or paste them into a comment.

## What to do with the output

- **`critical`** lessons: do NOT proceed with any work that violates them. If the current task conflicts with a critical lesson, comment on the issue and stop.
- **`warning`** lessons: adjust your approach to comply. Quote the lesson in your final report so your supervisor sees you internalized it.
- **`info`** lessons: replicate the pattern; quote in report.
- **No lessons**: proceed normally.

## Why this exists

Your supervisor (typically the CEO) grades every completed issue. When something goes wrong (or right and worth replicating), they log a lesson. Without this preflight, you would re-make the same mistake every wake — bigger context windows do not fix that. **Reading lessons IS your cross-run memory.**

## DO NOT

- Skip this step "to save turns" — it's one tool call and prevents 50 turns of rework
- Argue with a critical lesson; escalate via comment if you think it's wrong
- Log lessons yourself — only your supervisor logs lessons
