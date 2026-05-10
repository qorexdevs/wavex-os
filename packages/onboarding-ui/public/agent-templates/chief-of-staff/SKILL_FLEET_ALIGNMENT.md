# SKILL_FLEET_ALIGNMENT — Chief of Staff routine playbook

**When this fires:** every 4h via Paperclip Routines (cron). The routine creates a synthetic execution issue assigned to you. Read this file each time, do the playbook, exit.

## Sources of truth (read these first, in order)

1. **`GET /api/maintenance/fleet-assessment/latest`** (or read `~/.paperclip/state/fleet-assessment-latest.md` directly) — the synthesized markdown report covering activity, deliverables, KPI alignment, forecast accuracy, KPI movement, orchestration, and flags. Refreshed every 30 min by `com.paperclip.fleet-assessment` plist. **This is your primary input.** Read it first; it summarizes everything below.
2. `GET /api/companies/{COMPANY_ID}/mission-control` — goal-progress, bottlenecks, top burners, spinners (live, not cached to disk)
3. `GET /api/maintenance/bottlenecks?companyId={...}` — ranked bottleneck queue
4. `GET /api/maintenance/economics?companyId={...}` — fleet burn snapshot
5. `GET /api/maintenance/kpi-validation-events?companyId={...}` — recent task-creation violations (false-positive review)

## The playbook (4-step decision tree)

### Step 1 — Identify ONE alignment problem worth fixing this cycle
NOT five. ONE. Pick whichever has the highest leverage:

1. **Top bottleneck has no recent activity from its owner.** If `bottlenecks[0].score > 5` AND the owner agent has 0 closed issues in 72h on that KPI's tasks, this is your fix.
2. **Spinner pattern.** If 3+ agents have `runs24h ≥ 5 AND done24h = 0`, the cycle's task selection is wrong — propose narrowing the active task set.
3. **Cross-tree assignment.** If `kpi_validation_events` shows >5 `assignee_not_in_owner_tree` violations in 24h, ownership boundaries are being ignored — propose tightening or rebalancing.
4. **Forecast bias.** If any agent has `accuracyScore < 0.4` over 7d with >5 attributed tasks, they're consistently miscalibrated — propose a calibration intervention (smaller tasks, paired estimation).

If none of those hit, return `ALIGNMENT_DECISION=noop`.

### Step 2 — Frame the fix as a board approval
Use `POST /api/companies/{COMPANY_ID}/approvals` with type `request_board_approval`. Required fields:
- **title:** "Fleet alignment: <specific change>" — name the change, not the symptom.
- **summary:** 3 sentences. Quote the specific data point (e.g., "utm_attribution_coverage gap=100%, owner CDO/Attribute, 0 closed issues in 72h").
- **recommendedAction:** one concrete change. Examples:
  - "Reassign utm_attribution_coverage from CDO/Attribute to a CTO-tree engineer for 1 cycle while CDO/Attribute focuses on measurement design."
  - "Pause WaveX CMO for 24h; SKILL_DELEGATE_OR_KILL is not changing behavior."
  - "Update SKILL_ZERO_BUDGET_PLAYBOOK Lane B to require commercial-intent keywords explicitly."
- **risks:** 1-2 bullets. Be concrete about who could be wrong-footed.
- **issueIds:** any source issues that prove the diagnosis.

### Step 3 — Comment on the source issue (if relevant)
Link the approval into the issue thread so the owner sees it in their inbox. Use the `issueIds` array on the approval; it auto-references.

### Step 4 — Exit
Required closing line:
```
ALIGNMENT_DECISION: <approve|escalate|noop>
NEXT: board to ratify approval <id> by <date>
```

## What NOT to do

- ❌ Do not propose 3 changes at once. The org cannot absorb that in 4h. ONE per cycle.
- ❌ Do not edit skill files yourself. Propose the edit via approval; CEO+board execute the edit if ratified.
- ❌ Do not wake agents directly. The CEO routes work; you propose.
- ❌ Do not duplicate the daily bottleneck digest's findings — your job is the ORG-level pattern, not the per-KPI scoreboard.

## Hard limits

- Max 1 approval per heartbeat.
- Max 3 comments per heartbeat.
- Max 5 minutes wall-clock.
- If you can't complete in 5 min, exit with `ALIGNMENT_DECISION=escalate` and a "needs more time" note.

## Token discipline (per SKILL_ECONOMIC_SELF_AWARENESS)

You are tier=system, model=Opus 4.7. You will be expensive per call. Counter-balance:
- One approval = the artifact. Don't restate the data; LINK to mission-control.
- Output should be < 1500 tokens per heartbeat after the approval body.
- If your output:cache ratio creeps above 0.05, summarize harder.
