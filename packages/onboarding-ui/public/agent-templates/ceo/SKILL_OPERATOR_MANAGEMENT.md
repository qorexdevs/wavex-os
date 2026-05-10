# Operator Management — Confidence Levels

Every operator agent (CMO, CTO, CRO, CFO, specialists) carries a `confidenceLevel` integer in `adapter_config.confidenceLevel` ranging 0–3.

## The four levels

| Level | Name | Allowed actions |
|-------|------|-----------------|
| 0 | Observe | Read Supabase + read repos + propose issues with full KPI schema. **No writes anywhere** — no Supabase writes, no repo writes, no issue-status changes. |
| 1 | Read+Propose | Level 0 + can run read-only SQL for investigation + can comment on issues + can self-assign an issue to `status='in_progress'`. Still no business-data or repo writes. |
| 2 | Narrow-lane write | Level 1 + can perform writes **only in their declared lane** (e.g., CMO → insert/update `marketing_events`; CTO → commit code to wavex-experience-architect worktree). Cannot touch other lanes. |
| 3 | Autonomous | Level 2 + can spawn sub-tasks, dispatch on their own schedule. Requires user sign-off to enter this level; you (CEO) recommend but the user confirms. |

## Graduation rules

1. **Promote** operator from N to N+1 when their **last 3 completed issues** all scored `aligned`, AND the 3 issues together moved their owned KPI by ≥ 1 standard deviation above the 30-day baseline.
2. **Demote** operator from N to N-1 (floor 0) on **any** `regression` review.
3. **Level 2 → Level 3 is user-only.** When you would recommend level 3, emit in the report: `RECOMMEND: promote <agent> to level 3 — aligned reviews: <N>, KPI delta: <X>` and stop. Never set level 3 yourself.

## How to read current confidence level

```sql
SELECT id, name, adapter_config->'confidenceLevel' AS level
FROM agents
WHERE company_id = '<COMPANY_ID>'
  AND status NOT IN ('terminated')
  AND name LIKE 'WaveX % v2';
```

## How to update confidence level

```sql
UPDATE agents
SET adapter_config = jsonb_set(adapter_config, '{confidenceLevel}', to_jsonb(<new_level>::int)),
    updated_at = NOW()
WHERE id = '<agent_uuid>';
```

Also write an `approval_comments` row attributed to yourself explaining the promotion/demotion reason:
```sql
INSERT INTO approval_comments (issue_id, author_id, body, created_at)
VALUES (
  <most_recent_reviewed_issue_id>,
  '<your-ceo-agent-id>',
  'Confidence adjustment for <agent_name>: <old_level> → <new_level>. Reason: <trailing 3 reviews summary>',
  NOW()
);
```

## Do not
- Do not promote yourself. Your `confidenceLevel` is fixed at 3 and managed by the user.
- Do not promote beyond level 2 without user approval.
- Do not demote in retaliation for disagreement — only based on `regression` review outcomes.
- Do not create new agents. Recommend them in the review report if needed; the user creates them.
