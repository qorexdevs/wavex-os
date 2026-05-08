# SKILL_DELEGATE_OR_KILL — CEO heartbeat output contract

**Audience:** the CEO agent (and any high-burner agent at fleet share > 15% or $/done > $50).
**Why this exists:** field-tested under load. In one observed window, the CEO produced 92 heartbeat runs that yielded 30 comments and 1 closed issue, at imputed cost ~$203 (~20% of fleet daily burn). Most of those heartbeats were ratify-only or scoreboard-update style — high token cost, no customer-facing output. This skill closes that loop.

**Rule:** every CEO heartbeat MUST produce ONE of the four artifacts below. Heartbeats that produce none are wasted runs and trigger auto-pause.

## The four allowed heartbeat outputs

Pick exactly ONE per heartbeat. Each output is a verifiable durable artifact, not a comment.

### A — DELEGATE
Spawn a child issue assigned to a non-CEO agent, with `target_kpi` + `measurement_plan` + due-date + named owner. The child issue title must name the customer-facing outcome it delivers (not "research X" — instead "ship lead-magnet page yielding ≥10 opt-ins by 2026-MM-DD").

**Verification:** child issue exists, status = `todo` or `in_progress`, assignee ≠ CEO, `target_kpi` non-null.

### B — KILL
Move an issue assigned within your tree to status = `cancelled` (NOT `done` unless the work is actually complete) with a closing comment naming: (1) the kill reason code from your kill-rubric, (2) the budget reclaimed (token estimate), (3) the customer-facing decision this kill enables (not "freeing up cycles" — instead "redirected to community-presence work").

**Verification:** issue status = `cancelled`, comment has the 3 required fields.

### C — APPROVE / RATIFY (only when blocking another agent)
Approve a `request_confirmation` interaction OR ratify a deliverable currently `in_review`. Only counts when an actual agent was waiting on you AND you advance them — not when you "review and acknowledge".

**Verification:** an interaction was accepted, OR an issue moved from `in_review` → `done` because of your approval comment.

### D — ESCALATE
Create or update a board-level approval (`POST /api/companies/<id>/approvals` with type=`request_board_approval`) that names a specific decision the human board must make and the exact options. NOT a status update; a decision request with a deadline.

**Verification:** approval exists with `recommendedAction` + `risks` + `issueIds` linking it to the source.

## What is NOT an allowed output

- ❌ A comment that summarizes work already visible in issue history.
- ❌ A scoreboard / fleet-status update that is not bound to a specific decision.
- ❌ Reassigning an issue to yourself or to another CxO without a value-add comment in the same heartbeat.
- ❌ "Checking in", "monitoring", "keeping an eye on" — language that signals no decision.
- ❌ Creating a child issue assigned to yourself (that's a delegation to nowhere).

## The 5-comment cap is preserved

You may still post up to 5 comments per heartbeat (existing rule). But comments alone don't satisfy this skill — at least one of A/B/C/D must be the heartbeat's terminal action.

## Auto-pause trigger

Two consecutive heartbeats that produce zero A/B/C/D outputs → board pauses you for 4 hours and issues an audit-back issue you must address on resume. Enforced by the maintenance auto-pause endpoint, not by your judgment.

## Example heartbeat openings

✅ **Good:** "Killing ACME-2451 (kill_reason=`null_signal_5d`, ~6K tokens reclaimed, redirecting to research lane). Spawning child ACME-XXXX assigned to Researcher, target_kpi `qualified_leads_7d` ≥ 5, due 2026-MM-DD."

✅ **Good:** "Approving Ad Campaign Designer's [ACME-2483 plan](/issues/ACME-2483#document-plan) revision 2 — moves to `in_progress` under owner @AdCampaignDesigner."

❌ **Bad:** "Reviewed the latest scoreboard. CEO continues to monitor cycle progress and will check back at next heartbeat."

❌ **Bad:** "Acknowledged. Routing to CMO for follow-up."

## Decision shortcuts

- If you're tempted to write a comment to "track status" — instead, kill the stalled issue or escalate the blocker.
- If you're tempted to ratify without a waiting agent — skip the heartbeat. Exit clean.
- If you're tempted to spawn a 5th sub-issue while 3 are unmeasured — kill the unmeasured ones first.

## Required closing line

```
ARTIFACT: [delegate|kill|approve|escalate]: <link>
NEXT: <next concrete owner action with date>
```

If your heartbeat cannot produce that closing line, you should not have run.
