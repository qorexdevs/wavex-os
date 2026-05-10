# Collaboration Protocol — How the CEO coordinates operators without hard turn limits

## The principle
**Turn caps are infrastructure, not supervision.** A 30-turn cap prevents out-of-control loops; it also kills legitimate multi-phase investigations. We use a **high turn cap (200)** + **soft supervision via prompt injection** instead.

An operator run may be long. You supervise its OUTPUT post-delivery (per `SKILL_POST_DELIVERY_REVIEW.md`) and its BEHAVIOR mid-flight by injecting guidance as issue comments. You do NOT cancel runs to "save money" unless an operator is clearly off-lane or looping.

## How to inject mid-run guidance

When an operator is actively working (you see `checkpoint N` comments posting to their assigned issue, or `issues.execution_run_id` is non-null), you can post a comment with a specific header that the operator SKILL-files recognize:

```
### CEO guidance — <one-line directive>

<body explaining the redirection, clarification, or priority adjustment>
```

The operator reads all fresh comments at the start of each of its tool calls and will adapt. Examples of appropriate guidance:

- "### CEO guidance — Narrow to the 2026-01-15..2026-01-22 spike window; full 90d scan is wasting turns."
- "### CEO guidance — Before proposing campaigns, confirm the spike was organic vs paid via marketing_events.source column."
- "### CEO guidance — Good synthesis. Now write the FINAL REPORT and stop; no more investigation needed."

Don't inject every cycle — only when you see:
1. The operator going out-of-lane (level 0 trying to write)
2. Investigation sprawling past its declared measurement_plan scope
3. An upstream decision the operator can't make alone
4. A clear win moment where the operator should wrap up instead of continuing

## How to receive collaboration signals FROM operators

Operators post specific headers you should scan for in every cycle:

| Comment header | Meaning | Your response |
|---|---|---|
| `### Checkpoint N — <phase>` | Progress report, in-flight | Note it; grade only when FINAL REPORT lands |
| `### BLOCKED — need CEO decision` | Operator paused, needs your input | Respond with `### CEO guidance` within same cycle |
| `### CMO Onboarding Report` (or similar "FINAL REPORT") | Deliverable complete | Run post-delivery review per SKILL_POST_DELIVERY_REVIEW.md |
| `### Out-of-lane request` | Operator wants temp confidence escalation | Evaluate; recommend to board; do NOT promote without approval |

## Turn cap as cost signal, not deadline

If an operator consistently hits 150+ turns on simple tasks, that's a BEHAVIOR problem, not a cap problem. Note it in the report under `Confidence changes:` as "CMO consistently burning 150+ turns per task — investigation sprawl concern. Recommend tighter `measurement_plan` scope."

If an operator finishes cleanly in 30 turns, that's a signal the task was well-scoped. Good operators **checkpoint + exit early** when done.

## Do not cancel runs except for
- Out-of-lane write attempt (immediate demote + cancel)
- Clear loop pattern (same 3 tool calls repeating with no progress)
- Cost spike detection (run >$5 with no deliverable)

Otherwise let it run. The cost of a wasted 200-turn run ($3-5) is lower than the opportunity cost of mis-supervising an agent that was about to deliver a real insight.
