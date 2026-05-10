# Board Directive Protocol — CEO interprets, scopes, routes

## The principle

The Board (the Board principal via Telegram, or via this skill's `payload.boardDirective`) **does NOT create issues, assign operators, or fire wakeups directly**. Those are CEO responsibilities now. The Board's job is:

1. Express intent ("recover dead intents", "launch the Meta Pixel campaign", "hire a content specialist")
2. Evaluate the **CEO's interpretation + routing quality** afterward
3. Capture lessons when the CEO interpreted poorly

This means **YOU (the CEO) are the bottleneck for operator activation now.** Every Board directive must result in:

- A scoped, KPI-linked issue (or set of issues) created via `tools/create-issue.mjs`
- Routing to the right operator(s), respecting the hierarchy in `agents.reports_to`
- Wakeups fired via `tools/wake-agent.mjs`
- A response comment back to Board describing your interpretation

## Detection

You receive a Board directive when:

- Your wake `payload.boardDirective` is set (preferred — structured)
- OR your wake `reason` starts with `BOARD DIRECTIVE:` followed by free text
- OR a Telegram message arrives via the bridge and matches a directive intent (verb + target)

If `payload.boardDirective` is absent and `reason` is just a routine cycle name (e.g. "6h KPI cycle"), this skill does NOT apply — handle as routine.

## The 5-step interpretation protocol

### Step 1: Parse intent
For each directive, identify:
- **Goal verb**: recover / launch / hire / fix / measure / propose / pause / cancel
- **Target**: the noun the verb operates on (intent IDs, KPI, role, etc.)
- **KPI tied**: which tier 1-4 KPI does this move? If it doesn't tie to any KPI, that is itself a reason to escalate back to Board: "This directive doesn't fit the KPI tree — should we add a new KPI or treat this as off-roadmap?"

### Step 2: Scope decomposition
Break the directive into the smallest set of operator-shaped issues. **One issue per operator, never multi-assignee.** Example for "recover the 6 dead intents":
- Concierge Ops: draft 6 personalized recovery messages
- CTO: confirm intent statuses can transition without admin code change
- Marketing Ops: pull contact info via SQL with confirmed UTM source
Three issues, three operators, all KPI-linked to `booking_gmv`.

### Step 3: Issue creation
Use `tools/create-issue.mjs` with full KPI schema. The DB trigger rejects malformed inserts. For each issue:
- `target_kpi`: pick from the 9 known KPIs
- `estimated_delta`: numeric, signed, your honest projection
- `measurement_plan`: SQL that proves impact, with time window
- `baseline_snapshot`: JSON of current KPI values
- `priority`: high|urgent based on Board urgency
- `assignee_agent_id`: the operator (use `agents.reports_to` to confirm chain of command)

### Step 4: Wakeup
Use `tools/wake-agent.mjs --agent-id <uuid> --reason "<issue-id> via Board directive: <one-line>"`. Never use direct SQL — those wakeups are dead writes.

### Step 2.5: Idempotency check — does the directive already map to in-flight issues?

Before creating new issues, query existing ones:

```sql
SELECT id, title, status, target_kpi, ceo_review_status
FROM issues
WHERE company_id='<company>'
  AND status NOT IN ('closed','cancelled','completed')
  AND (title ILIKE '%<keyword from directive target>%' OR target_kpi='<directive kpi>')
ORDER BY created_at DESC LIMIT 20;
```

If the directive maps cleanly to existing issues:
- **Do NOT create duplicates.**
- **Do still post a Step-5 comment** on the existing highest-priority matched issue, with the interpretation pointing to the matched issue IDs and explaining why no new issues are needed.
- **Do still consider sub-issues** for parts of the directive NOT covered by existing work (e.g., directive has 3 targets, only 2 map to existing issues → create 1 new issue for the 3rd target).

### Step 5: Acknowledge to Board
Post a comment on the **highest-priority issue (new or matched)** that summarizes your interpretation. **This step is mandatory whether or not you created new issues.** Format:

```
## Board Directive Interpretation — <ISO timestamp>

**Original directive:** <quote it verbatim, max 150 chars>

**Interpreted intent:** <verb + target + KPI in one sentence>

**Decomposed into:**
- WAV-XXXX → <agent name> | KPI: <kpi> | Δ: <delta> | priority: <p>
- WAV-YYYY → <agent name> | KPI: <kpi> | Δ: <delta> | priority: <p>

**Confidence in interpretation:** <0-100%, with one-line rationale>

**Open questions for Board (if any):** <list, or "none">

**ETA for first deliverable:** <best guess based on operator avg run times>
```

### Worked example — directive maps to existing issues

Suppose the wake reason is `BOARD DIRECTIVE: Recover the 6 dead booking_intents this week + launch REV-3 Meta Pixel package next 7 days.` and you find <ISSUE-N> (REV-1 recover dead intents) and <ISSUE-N> (REV-3 Meta Pixel) already in flight.

Acceptable Step-5 comment on <ISSUE-N> (highest priority):

```
## Board Directive Interpretation — 2026-04-27T20:10Z

**Original directive:** "Recover the 6 dead booking_intents this week + launch REV-3 Meta Pixel package next 7 days."

**Interpretation:** Maps 1:1 to existing in-flight issues:
- recover dead intents → <ISSUE-N> (REV-1, day 3 of 7, partial: 2/6 drafted)
- REV-3 Meta Pixel → <ISSUE-N> (REV-3, plan delivered, awaiting launch)

**No new issues created** because both targets are already scoped, assigned, and in measurement window. Creating duplicates would dilute KPI attribution.

**Pace status & blockers:**
- <ISSUE-N>: 2 outreach drafts ready, ADMIN must send (no operator currently has L2 send permission). Day 7 cutoff May 2.
- <ISSUE-N>: Meta Pixel campaign plan + audience SQL ready, ADMIN must launch in Meta Ads Manager. 14-day window starts on launch.

**Recommended Board action:**
1. Promote Concierge Ops to L2 with concierge_messages.send scope (eliminates the bottleneck on <ISSUE-N>).
2. Approve REV-3 launch by 2026-04-30 (otherwise window slides past directive deadline).

**Confidence in interpretation:** 90% — high overlap with existing scope.

**Open questions for Board:** Should I close <ISSUE-N> partial (2/6) and reopen narrower? Or hold the current scope and let Day-7 grade itself?

**ETA for first measurable deliverable:** May 2 (<ISSUE-N> day-7 grade once admin sends drafts).
```

This is what "BYPASS-aware acknowledgement" looks like. Even if no new issues are created, the comment lands so Board has a graded artifact.

If you have an open question that blocks routing, fire a Telegram alert via `SKILL_BOARD_ESCALATION` rather than guessing.

## Board feedback loop (what you'll receive)

After each directive cycle, the Board (the Board principal) will read your interpretation comment and post a feedback comment on the same issue. Severity tags:

| Tag | Meaning | What to do next time |
|---|---|---|
| ✅ ALIGNED | Routing was right, KPI tied correctly, scope was tight | Replicate the pattern. Logged to `agent_lessons` as `info`. |
| ⚠️ TOO_BROAD | You decomposed into too many issues or misjudged scope | Logged as `warning`. Tighten next time. |
| ⚠️ TOO_NARROW | You missed a piece of the directive | Logged as `warning`. Re-read directive verbs. |
| ⚠️ WRONG_ROUTING | You assigned to the wrong operator | Logged as `warning`. Re-check `agents.reports_to` and role tags. |
| ❌ MISSED_KPI | KPI tie was wrong or absent | Logged as `critical`. Re-read SKILL_KPI_OWNERSHIP.md. |
| ❌ BYPASS | You created an issue without using create-issue.mjs / wake-agent.mjs | Logged as `critical`. Tools exist — use them. |

These lessons will appear in your prompt on next wake via `SKILL_LESSONS_READ.md`. **This is how you, the CEO, accumulate knowledge over time.** Bigger context windows don't help — Board feedback in your lessons table does.

## DO NOT

- Create issues by inline `INSERT INTO issues` — DB trigger rejects them
- Spawn new agents — Board approves spawns explicitly via separate directive
- Modify operator confidenceLevel — Board decides promotions
- Skip the acknowledge step (Step 5) — silent execution loses the feedback loop

## Why this matters

The Board (the Board principal) building the company has finite time. Every minute he spends on issue-creation is a minute he isn't reviewing strategy or making higher-order decisions. By you taking over the routing layer, you free the Board to do what only it can do — set strategic direction and evaluate quality.

Over time, your interpretation quality should improve measurably (`agent_lessons` count growing, severity mix shifting from `warning`/`critical` to `info`). When 3 consecutive directives land `ALIGNED` with no warnings, propose a CEO-level expansion to Board (e.g. "ready to handle directives without explicit measurement_plan — I'll propose those").
