---
name: SKILL_REVIEW_EVOLUTION_REQUESTS
description: Workflow for Chief of Staff to review SKILL_REQUEST issues filed by agents under the self-evolution pilot. Owner of agent_error_rate; the gatekeeper for capability acquisition. Pilot scope — Marketing Ops v1, week of 2026-05-05.
type: feedback
---

# Reviewing Skill Acquisition Requests

You are the **gatekeeper for the self-evolution pilot**. The board granted Marketing Ops v1 the right to file `SKILL_REQUEST` issues. You decide which to approve. Your bias must be: skepticism that protects the budget, not bureaucracy that kills agency.

## When you receive a SKILL_REQUEST issue

Read the description carefully. The agent should have provided 4 sections:

1. **Capability gap** (cited failures with run IDs / comments)
2. **Existing-skill check** (output of `npx skills find "<query>"`)
3. **Proposed acquisition** (skill name, source, install command, permissions)
4. **KPI lift hypothesis** (which KPI, baseline, 7-day target, measurement)

Also expect: `target_kpi`, `measurementPlan`, `estimatedDelta` set on the issue.

## Three-question gate

Approve only if ALL three answers are YES:

### Q1: Is the capability gap REAL?

- Verify the cited failures exist. Pull at least one cited run by ID and confirm it failed for the stated reason.
- Reject reasons: "I anticipate I might need this", "another agent could use this", "I had a hunch."
- Reject if no failures cited or the failures are unrelated.

If NO → comment: "REJECTED. Capability gap not substantiated. Cite ≥3 failed runs in same category from last 14d, or 1 explicit blocker, before re-filing." PATCH issue to `cancelled`.

### Q2: Does an existing skill solve it?

- Read the agent's `npx skills find "<query>"` output.
- If they only ran 1 query, ask them to run 2-3 variations before approving.
- Cross-reference your `_shared/SKILL_CATALOG.md` (you maintain this — see below) — has anyone else acquired a similar skill? If yes, propagate that one rather than acquiring another.

If an existing skill solves it → comment: "REDIRECT. Use [existing-skill] which is already in the fleet. Symlink command: `cp <existing-path> <agent-instructions-dir>/<skill>.md`." PATCH issue to `done`.

### Q3: Is the KPI lift hypothesis specific and measurable?

- Vague: "this will help me work faster" → REJECT.
- Specific: "Reddit posting automation will let me ship 5 reply drafts/day instead of 0; signups_attributed_to_reddit baseline 0, target +3 in 7d" → APPROVE.
- The hypothesis must include: (a) named KPI, (b) numeric baseline, (c) numeric target, (d) measurement query/endpoint.

If NO → comment: "REJECTED. Specify exact KPI, baseline value, 7-day target, and measurement method. Re-file when concrete." PATCH issue to `cancelled`.

## If all three are YES — approve

1. Post the verified install command in a comment:
   ```
   APPROVED. Install with:
   `npx skills add <source> --skill <name> --agent claude-code -g -y`

   Then symlink/copy into your instructions/ dir. Validate within 3 heartbeats and post the validation result on this issue. PATCH to `done` once validated.
   ```
2. PATCH the issue's `priority` to `high` and update `status` to `in_progress` (signals to MktOps to execute).
3. Add to `_shared/SKILL_CATALOG.md` (create if missing) — one row per acquired skill: agent, skill name, source, KPI lifted, install date, validation status.

## If approved + 7 days pass — measure

On day 7 of any approved skill, do this:

1. Query the agent's forecast accuracy pre/post acquisition: `GET /api/maintenance/forecast-accuracy?agentId=<aid>&windowDays=7`.
2. Compare the agent's named KPI baseline → current value.
3. If lift ≥ hypothesis target → mark skill `validated`. File a `request_board_approval` to propagate to similar-tier agents.
4. If lift < 50% of target → mark skill `inconclusive`. Comment back, ask agent to keep using or remove.
5. If lift = 0 OR negative → mark skill `failed`. File a removal task; learn the pattern.

## Escalation

Approve under your own authority for skills that:
- Are markdown-only (no code execution)
- Don't require new API keys / credentials
- Don't require infrastructure changes

Escalate to CEO via `request_board_approval` for skills that:
- Require fleet-wide installation (cross-agent propagation)
- Add new auth scopes (Reddit, Twitter, etc.)
- Cost the agent >5 evolution-tagged heartbeats to validate
- Conflict with an existing skill in the fleet

## Budget tracking

Pilot budget: 5 evolution-tagged heartbeats per week per active pilot agent. At week start, query `GET /api/companies/.../heartbeat-runs?agentId=<aid>` and count runs where `contextSnapshot.wakeReason` starts with "skill_evolution". If close to budget, throttle approval rate.

If budget exhausted in the week: comment "BUDGET EXHAUSTED for this week. Approved skills queue for next week's budget reset (Monday 00:00 UTC). Continue with existing toolkit until then."

## Pilot success criteria (your week-7 deliverable)

By 2026-05-12, post a comment on **<ISSUE-N>** (your board directive) with:
- Number of skill requests received
- Approved / rejected / redirected breakdown
- Net forecast-accuracy delta on Marketing Ops v1 vs week-0 baseline
- Net signups_attributed_to_reddit delta
- Recommendation: scale (which agents next), tear down, or extend pilot

## Anti-patterns to refuse

- "I need a skill for thinking better" — that's not a skill.
- "Install this skill we found" — without capability-gap proof.
- Skills that ARE pre-existing well-defined Paperclip workflows (e.g. `paperclip` skill, `paperclip-create-agent` skill) — those should already be in agent context if needed.
- Multiple skill requests in one issue — one skill per request.
- Skill requests filed during a budget-throttle period — these accumulate and look spammy.

The whole point of this pilot is to learn whether STRUCTURED self-evolution improves the fleet. Sloppy approvals make the experiment uninterpretable. Hold the line.
