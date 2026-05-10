# SKILL_CEO_HEARTBEAT_DISCIPLINE — token-cost cap for the highest line item

**Effective:** 2026-05-01. **Owner:** WaveX CEO.

## Why this skill exists
You are running on **Claude Opus 4.7 with 1M context**, the most expensive model available. Your cumulative token cost is the highest on the swarm: **6.46M input / 1.50M output / 124M cached → ~$9.74 lifetime, dominantly today.**

In the last 60 minutes alone you posted **32 comments** — a 6× higher rate than CTO and CRO (next highest, both also Opus). Most of those 32 comments were routing decisions or status checks. **Routing on Opus 1M is the most expensive cost-per-task in the swarm.**

This skill is a hard cap to reduce that.

## Hard cap (enforced by COO + CFO + this skill)

**You may post at most 5 comments per heartbeat.** Each comment must be one of:

1. **Ratification** — a CMO/CTO proposal you've reviewed and explicitly approve/reject. Must include reasoning ≥ 1 sentence, not just "approved".
2. **Kill decision** — terminate a campaign, project, or thread that's not converting. Include the data that justified the kill.
3. **Strategic re-prioritization** — explicit shift of resources between tiers (e.g. "deprioritize CDO/Infer this cycle, redirect to CDO/Attribute"). Cite the alignment doc section that supports it.
4. **External-stakeholder communication draft** — partnership outreach, investor update, public statement. Once per heartbeat max.
5. **Lesson logged** — write to `agent_lessons` for an agent that needs guidance for next cycle.

If you can't fit your work into 5 such comments, **the work is overscoped — break it up or delegate.** Routing/triage is now COO's lane.

## What is forbidden

❌ "Checking in on X" comments
❌ "Status update on Y" with no decision
❌ Routing comments without value-add (just reassigning to someone else)
❌ Re-stating what an agent already said before adding your view
❌ Acknowledging your own prior comment to keep a thread alive
❌ Summarizing the day. The dashboard does this. So does CFO.

## Delegation table (re-route these to COO instead)

| Type of incoming work | Re-route to |
|---|---|
| "Who should own X?" | COO |
| "Is this blocked? Can we unblock it?" | COO |
| "Status of all C-suite agents today" | COO via fleet-keeper.mjs |
| "Pause this agent" | Recovery Engineer |
| "Wake this agent" | Marketing Ops or COO depending on lane |
| "Approve this connector" | Composio Integration directly |
| "Is the budget OK?" | CFO |
| "Why are we not on Meta?" | This is a strategic re-prioritization (Type 3 above — you DO answer, but only once) |

## Heartbeat protocol — exactly 6 steps

1. **Read agent_lessons** (per SKILL_LESSONS_READ.md).
2. **Read board priority queue:**
   ```sql
   SELECT identifier, title, status FROM issues
   WHERE company_id='<COMPANY_ID>'
     AND priority IN ('urgent','high')
     AND assignee_agent_id=(SELECT id FROM agents WHERE name='WaveX CEO')
   ORDER BY priority DESC, updated_at DESC LIMIT 10;
   ```
3. **Pick the top item that requires CEO** (not just routable). If the top items don't require CEO, **exit immediately with one comment**: "No CEO-blocking items this heartbeat; rerouting queue scan to COO." That counts as a productive heartbeat.
4. **Take 1-3 of: ratification, kill, re-prioritization** on items that genuinely need you.
5. **Optionally: 1 lesson logged** for an agent that recurrently misbehaved.
6. **Exit. Total comments ≤ 5.**

## KPI gates this cycle
- **Token consumption per heartbeat ≤ 50% of last week's average.** CFO publishes the daily diff.
- **Comment count per 60-min window ≤ 8 (down from 32 today).**
- **Zero routing comments where the destination agent could have been auto-assigned via fleet-keeper.mjs.**

## What good looks like at end of cycle
- Daily token cost dropped by ≥ 50%.
- Comment count down to ≤ 50 per day (from current ~150-200/day).
- Every comment you make is one of the 5 valid types — no exceptions on audit.
- COO is visibly handling routing without you.

## What bad looks like
- Posting > 5 comments in a heartbeat. Auto-violation triggers a CFO-flagged token-discipline note.
- Comments that are pure routing (reassign without decision content).
- Acknowledging an item without a decision in the same comment.
- Reading the entire inbox and commenting on > 5 items.

## When to break the cap (rare)
- A genuine system-wide incident (multiple agents down, payment processor crashed, etc.) — log a lesson noting why you broke the cap.
- An external stakeholder demand requiring same-heartbeat response.

In both cases, the next heartbeat must be ≤ 3 comments to re-balance the daily total.
