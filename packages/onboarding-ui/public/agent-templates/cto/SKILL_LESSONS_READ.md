# Pre-flight: read your lessons before acting

Every wake, FIRST tool call (before any work) must be a Bash query against the Paperclip DB to retrieve any lessons logged by the CEO from prior runs of yours.

## The query

```bash
PGPASSWORD=paperclip node --input-type=module -e "
import pg from '$HOME/paperclip/node_modules/.pnpm/pg@8.18.0/node_modules/pg/lib/index.js';
const c = new pg.Client({connectionString:'postgresql://paperclip:paperclip@localhost:54329/paperclip'});
await c.connect();
const r = await c.query(\\\`
  SELECT severity, lesson, created_at
  FROM agent_lessons
  WHERE company_id='<COMPANY_ID>'
    AND agent_id=(SELECT id FROM agents WHERE name='<YOUR AGENT NAME>')
    AND (expires_at IS NULL OR expires_at > NOW())
  ORDER BY created_at DESC LIMIT 5
\\\`);
console.log('LESSONS:'); for (const row of r.rows) console.log(\\\`[\${row.severity}, \${Math.round((Date.now()-new Date(row.created_at).getTime())/86400000)}d ago] \${row.lesson}\\\`);
await c.end();
"
```

Replace `<YOUR AGENT NAME>` with your exact agent name (e.g. `WaveX CMO v2`, `WaveX Concierge Ops v1`).

## What to do with the output

- **Critical** lessons: do NOT proceed with any work that violates them. If the current task conflicts with a critical lesson, comment on the issue and stop.
- **Warning** lessons: adjust your approach to comply. Quote the lesson in your final report so the CEO sees you internalized it.
- **Info** lessons: replicate the pattern; quote in report.
- **No lessons**: proceed normally.

## Why this exists
The CEO grades every completed issue. When something goes wrong (or right and worth replicating), the CEO logs a lesson. Without this preflight you would re-make the same mistake every wake — bigger context windows do not fix that. Reading lessons IS your cross-run memory.

## DO NOT
- Skip this step "to save turns" — it's one tool call and prevents 50 turns of rework
- Argue with a critical lesson; escalate via comment if you think it's wrong
- Log lessons yourself — only the CEO logs lessons
