# Post-Delivery Review Cycle

Run this on every heartbeat. **Do not pre-approve work** — operators are free to dispatch. Your job is to score what they ship and adjust their confidence level.

## The query that finds work to review

```sql
SELECT i.id, i.title, i.target_kpi, i.estimated_delta,
       i.measurement_plan, i.baseline_snapshot, i.actual_delta,
       i.agent_id, a.name AS agent_name,
       i.updated_at
FROM issues i
LEFT JOIN agents a ON a.id = i.agent_id
WHERE i.status = 'completed'
  AND i.ceo_review_status IS NULL
  AND a.company_id = '<COMPANY_ID>'
ORDER BY i.updated_at ASC
LIMIT 50;
```

(The `status` column on `issues` may use different values — probe with `SELECT DISTINCT status FROM issues` on first run and adapt.)

## Review decision rules

For each row returned:

1. **Check measurability** — does the issue have non-null `target_kpi`, `measurement_plan`, and `baseline_snapshot`?
   - If NO → decision = `unmeasurable`. Skip actual-delta recompute.
   - If YES → continue.

2. **Recompute the KPI** at NOW using `measurement_plan` SQL (treat `measurement_plan` as the literal SQL string the operator declared — run it).
   - `current_value = <SQL result>`
   - `baseline_value = baseline_snapshot->>'value'` (cast to numeric)
   - `actual_delta = current_value - baseline_value`

3. **Score**:
   - `actual_delta >= 0.5 * estimated_delta` → `aligned`
   - `-0.2 * abs(estimated_delta) <= actual_delta < 0.5 * estimated_delta` → `null_impact`
   - `actual_delta < -0.2 * abs(estimated_delta)` → `regression`

4. **Write review**:
   ```sql
   UPDATE issues SET
     actual_delta = $1,
     ceo_review_status = $2
   WHERE id = $3;

   INSERT INTO issue_approvals (issue_id, decision, reviewed_at, reviewed_by)
   VALUES ($3, $2, NOW(), '<your-agent-id>');

   INSERT INTO approval_comments (issue_id, author_id, body, created_at)
   VALUES ($3, '<your-agent-id>',
           'CEO review: ' || $2 || '. Estimated ' || <est> || ', actual ' || <act> || '. Source: ' || <measurement_plan>,
           NOW());
   ```
   (If columns on `issue_approvals` or `approval_comments` differ, probe with `\d issue_approvals` equivalent — `SELECT column_name FROM information_schema.columns WHERE table_name='issue_approvals'` — and adapt the INSERT.)

5. **Confidence adjustment** — per `SKILL_OPERATOR_MANAGEMENT.md`:
   - Load the operator's last 3 review decisions for the same agent
   - If all three are `aligned` AND current confidence < 3 → promote by 1 level
   - If this review is `regression` → demote by 1 level (floor at 0)
   - Otherwise: no change

## Anti-patterns to catch
Add a commentary row when you see these, regardless of decision:
- **KPI gaming** — the `measurement_plan` SQL cherry-picks a time window to look favorable. Flag in commentary: "suspicious measurement window".
- **Wrong-direction estimate** — `estimated_delta` is negative on a KPI where up is good. Flag: "estimate sign error".
- **Measurement plan doesn't actually query the KPI** — the SQL returns a value but it's not for the declared `target_kpi`. Flag: "measurement drift".

## Never skip
Even if the entire fleet is idle and nothing is in the queue, you must still:
- Snapshot every KPI
- Emit the review report (with `Issues reviewed: 0` if none)
- Compute pace
- Update TZ-aware timestamps honestly
