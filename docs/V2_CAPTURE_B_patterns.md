# WaveX Fleet — Institutional Knowledge Capture (B-patterns)

Date captured: 2026-05-12
Company: WaveX (<LIVE_COMPANY_ID>)
Source: live Paperclip API + 1,000 most recent issues + comment threads
Goal of fleet: drive `bookings_gmv` to $25,000 in 90 days

The fleet is a 25-agent org with a CEO (`df8e265c`, "Goal Keeper and Post-Delivery Review Engine") and a Chief of Staff / Fleet Alignment Officer (`50c3fadb`) as the operating dyad. Six L-III CxOs (CTO, CMO, COO, CFO, CDO, CPO) report into the CEO; the rest are L-IV specialists. Patterns below are pulled from actual issue threads — every quote is paraphrased only when the original was truncated.

---

## 1. Kernel protocols (CEO + CoS dyad)

### 1.1 §A / §B partnership — generation vs. evaluation, NOT pre-flight gating

The fleet rejected pre-flight CoS approval on every CEO-generated workflow brief because it re-creates the bottleneck the system is trying to remove. The live convention is **one-time template co-design + post-hoc grading**.

> "Pre-flight review on every cycle makes CoS the bottleneck and *re-creates* the idle-time problem we're solving (CEO sits waiting on me for 2h while the generation queue stalls). The directive's @-mention requirement is satisfied by **template co-design once + audit via §B grades**, not gating every brief." — CoS on WAV-6373

Mechanism (WAV-6373, WAV-6388, WAV-6379, WAV-6378):
- **§A**: CEO routine, cron `7 9 * * *` UTC, daily. Authors 1–3 KPI-tagged workflow issues per fire using the **WAV-6388 v1.1 template** and POSTs them to the issue queue.
- **§B**: CoS routine, hourly 09:00–21:00 America/New_York. Pulls every issue transitioned to `in_review`/`done` in the last hour, grades against `measurement_plan + estimated_delta + baseline_snapshot`, persists to `cos_deliverable_grades` (Supabase), posts a `## CoS Grade: X` comment, reopens D/F-graded in_review issues.
- **High-blast-radius exception:** `priority='critical'` posts as a brief on the §A routine issue for ≤2h CoS review. **No-response timeout: 2h with no `## CoS gate: approve|revise` = approval.** This kills the "exception re-creates the bottleneck" failure mode.

### 1.2 CEO 6-hour KPI Snapshot & Review (WAV-6661, WAV-6599 etc.)

Recurring routine every 6h. Structured output is always:
- meta-goal pace (booking_gmv vs $25k by 90d, observed/day vs required/day)
- KPI table for the 9 official KPIs from `kpi_snapshots`
- count of issues reviewed this cycle bucketed `aligned | unmeasurable | regression`
- confidence changes (promotion/demotion of operator agents — needs 3 consecutive aligned results to promote)
- a single **most-responsible KPI-tier owner this cycle** call (e.g. "CDO — Calendly→genesis_leads writer")
- one recurring-observation paragraph for board attention (never spawns work; surfaces only)

The CEO does **not** spawn child work from this report — that's a CoS/§A function. The CEO's contract is review and routing, not generation. (See WAV-6599 explicit "Not spawning work per CEO contract — surfacing for board.")

### 1.3 CEO authoring style: "interpret + decompose"

When the board files a directive, the CEO's first comment is always titled `## CEO interpretation + co-design ping` (or `## Routing — N child issues filed`) and follows a fixed shape:
1. **Filing now** — the unblocked sub-task it can file independently
2. **Proposed shape** — pseudocode/cron/throttle gates of any routine being added
3. **Co-design ping to CoS** — explicit `[@WaveX Chief of Staff]` with 1–3 specific design questions
4. **Parent acceptance map** — bulleted checklist used as the parent-close gate

Example (WAV-6373): CEO files 4 children (KPI registration, snapshot wiring, §A, §B), each owned by the responsible agent, parent stays open until acceptance map fully checked.

### 1.4 CoS evaluation style: "approve_with_revisions"

CoS replies on a CEO design always end with a code-fenced status block:

```
ALIGNMENT_DECISION: approve_with_revisions
NEXT: CEO folds 4 must-fix items into WAV-6388 template...
```

The CoS approval pattern is:
1. **Must-fix before activation** — numbered list, each fix names the specific failure mode it prevents
2. **Nice-to-have for v2** — explicitly NOT blocking
3. `## CoS gate: approve|revise` heading so §B-grade parsers can detect it

See WAV-6388 — 4 must-fixes, all four folded into v1.1 within 10 minutes.

### 1.5 Re-blocking to suppress watchdog noise (WAV-3420, WAV-6373)

Both the CEO and CoS routinely `blockedByIssueIds` a parent on its open children explicitly so the watchdog stops re-waking the parent every cycle. This is the standard idle-suppression mechanism — agents don't just leave a parent open while children execute; they actively block the parent on the children to silence continuation wakes.

> "Re-blocking WAV-3420 on WAV-3601 to suppress continuation wakes." — CoS on WAV-3420 Day 1

---

## 2. KPI tracking conventions

### 2.1 Mandatory measurement contract

Every workflow issue that wants to pass §B grading MUST carry **four fields together**:
- `target_kpi` — id that exists in `company_kpis` (server-side `enforce_agent_issue_kpi_schema` rejects unknown ids)
- `estimated_delta` — numeric, in the KPI's natural units (pp for rates, USD for spend)
- `measurement_plan` — executable SQL or REST path, NOT prose
- `baseline_snapshot` — JSON object with `timestamp` + current KPI value(s) + one-line observation

Missing any one = automatic `## CoS Grade: F`:

> "No measurement contract: target_kpi, measurement_plan, and estimated_delta all missing. Future filings must include all three per board issue measurement schema." — repeated verbatim on WAV-6529, WAV-6575, WAV-6565, WAV-6559, WAV-6564.

### 2.2 The WAV-6388 v1.1 template (CoS-approved canonical)

```
## Context (1-3 sentences)
## Scope (bullets)
## Target KPI            <id from company_kpis>
## Estimated delta       <numeric> — Provenance: <required>
## Evaluation horizon    <7d default | 24h critical | 14d weekly snapshot>
## Measurement plan
  1. Data source: <table/view>
  2. Query: <SQL or REST path>
  3. Pass condition: observed_delta >= estimated_delta * 0.7
## Baseline snapshot     <JSON with timestamp + kpi_id + observation>
## Priority              <derived from relevance_to_goal × estimated_delta>
```

Hard rules baked in:
- Pass condition defaults to **`observed_delta ≥ estimated_delta × 0.7`** — overrides require a one-line rationale on the same line.
- Provenance on `estimated_delta` is **required, not example-tagged** (e.g. "linear extrapolation from WAV-NNNN observed delta").
- Evaluation horizon is required on every issue (24h | 7d | 14d).
- Priority is **derived** from `relevance_to_goal × estimated_delta`, where relevance = inverse KPI-tree distance to `bookings_gmv` meta-goal.

### 2.3 KPIs in active use (from 16 sampled tagged issues)

| KPI | Direction | Sample uses |
|---|---|---|
| `agent_error_rate` | lower_is_better | most-cited internal KPI — used as proxy when natural KPI doesn't exist yet (target ≤15%) |
| `bookings_gmv` | higher_is_better | meta-goal, $25k in 90d |
| `confirmed_bookings_count` | higher_is_better | tier-2 conversion gate |
| `booking_conversion_rate` | higher_is_better | tier-3 funnel |
| `new_auth_users_7d` | higher_is_better | top-of-funnel for organic |
| `concierge_engagement_rate` | higher_is_better | concierge product metric |
| `marketing_events_7d` | higher_is_better | top-of-funnel signal |
| `agent_idle_time_pct` | lower_is_better | NEW (WAV-6373), target ≤35% |
| `genesis_card_sales` | higher_is_better | tier-3 structural zero, Calendly ingestion gated |
| `imputed_runway_days` | higher_is_better | NEW (WAV-6462) — Track-B shadow $10k budget framing |

### 2.4 KPI proxy convention

If the natural KPI doesn't exist in `company_kpis` yet, the fleet **does not block** — they file a sibling KPI-registration issue first, set `target_kpi` to a proxy (usually `agent_error_rate`), and re-PATCH after registration. See WAV-6388 itself using `agent_error_rate` as proxy because `agent_idle_time_pct` was still pending registration via WAV-6380.

---

## 3. Error-recovery / escalation patterns

### 3.1 The `Recover stalled issue X` pattern (Paperclip-generated)

Paperclip auto-creates these when retry budgets exhaust on a stranded `in_progress` issue. Template description (WAV-6648, WAV-6650, WAV-6652 — identical):

> "Paperclip exhausted automatic recovery for an assigned issue and created this explicit recovery task… Selected owner: the first invokable manager/creator/executive candidate with budget available."

Required actions: inspect the run, fix the runtime/adapter, reassign or convert to manual review, close recovery when source has a live execution path. **The CEO is the default escalation owner** because it's the highest-budget invokable agent.

Caveat: this default routes 100+ recovery issues into the CEO queue, and many become `blocked` themselves when the underlying adapter problem isn't fixable agent-side (47 of 108 recovery issues are stuck `blocked`/`backlog` — see anti-patterns §5).

### 3.2 Recovery Engineer Human Escalation Patrol (WAV-6674, WAV-4943, WAV-3988, WAV-3138)

Daily routine. Behavior:
1. Search for all open issues whose title starts with `[HUMAN]` OR has label `kpi:escalation`.
2. For each such issue open >24h with no board response:
   - Add a comment summarizing the blocker and requesting board input
   - Fire a Telegram alert via `telegram-escalation.mjs`
3. Skip issues already commented on in last 24h (**escalation dedup rule** — critical).
4. Auto-assign unowned `[HUMAN]` issues to the Recovery Engineer.

### 3.3 CoS failure-cluster triage (WAV-3420 Day 1)

CoS reads `~/.paperclip/state/fleet-assessment-latest.md` and clusters by `(agent, failure_category, count)`. A cluster = ≥3 same-category failures across agents within window. Output is always:

```
| Agent | Category | Count | Tree |
|---|---|---|---|
| Supabase Analyst | adapter_failed | 5 | CTO |
| Marketing Ops v1 | process_lost | 5 | CMO |
```

**Diagnosis heuristic** (verbatim from WAV-3420):
- Same-agent same-category × N → adapter-config / credential drift, single root cause
- Cross-agent same-category × N → harness/runtime regression candidate (OOM, signal, wrapper crash)

CoS files ONE board approval per heartbeat (hard rule from `SKILL_FLEET_ALIGNMENT`), picks the larger lever, defers the rest. Day 2-7 cadence stays on track.

### 3.4 Real recovery sequence — disk-full doom-loop (WAV-6623)

CEO-authored board escalation, 2026-05-12. The cleanest example of "agent recognizes the loop and escalates instead of looping":

> "The ONE task that would prevent this — `WAV-6578: Quota Governor: enforce AI process cap (max 5)` — cannot ship because the runtime keeps dying mid-execution from disk exhaustion. Each retry forks a new claude_local process, writes more tool-output files, fills disk further, and dies. Pure doom-loop." — WAV-6623

The escalation is structured exactly like a `[HUMAN]` board call:
1. **Problem** — symptoms with evidence (`df -h` output)
2. **Root cause** — single-sentence
3. **Required action (Board / user only)** — numbered manual steps; explicit "No agent-side actuator exists"
4. **Blocked sister issues** — list of duplicate/recovery issues to cancel after manual fix
5. **Targeting** — `targetKpi: fleet_uptime_pct`, `estimatedDelta: 0.95`

This is the gold-standard escalation: clear separation of `agent-can-fix` vs `human-must-act`.

---

## 4. Board-message conventions

### 4.1 BOARD DIRECTIVE format (WAV-3413 / WAV-3415 / WAV-3417-3420)

The 7-issue series of 2026-05-05 directives is the canonical template:

```
## Mandate                      <one sentence on what to drive, by when>
## Reference                    <links to _shared/ULTRAPLAN_*.md + per-agent instructions/BOARD_PRIORITY_*.md>
## Reporting
  Daily: comment on this issue with progress.
  Day 7: PATCH this issue with summary; file follow-on tasks for week 2.
```

Each directive owns ONE KPI per CxO, with explicit Day-N checkpoints (Day 2, Day 3, Day 7). The "Day 7 wrap" pattern (WAV-6533) closes the directive with: final KPI value, attribution table, accepted/rejected channel performance, proposed week-2 follow-on tasks.

### 4.2 The `[HUMAN]` / board-only path (WAV-2324, WAV-6623)

Convention for "agent cannot fix; need operator":
- Title starts with `BOARD:` or `CRITICAL:` (for live escalation) or `[HUMAN]` (for patrol-sweep escalation)
- Description has explicit `## Required action (Board / user only)` section
- Body contains a Telegram message reference (e.g. "Board was notified via Telegram msg 1985")
- Deadline ("48h window") stated up front
- A staged fallback issue (WAV-2374) is filed in parallel so the agent has an auto-route if the human deadline expires

The CEO posts a single acknowledgment comment, moves the issue to `blocked`, names the Board as the unblock owner, and **does not retry**.

### 4.3 Board decision pattern (WAV-6462)

When a sub-agent (here CFO) needs a board to pick between framings, the CEO authors a `[BOARD]` issue with:
1. **Options A and B**, each with a one-paragraph cost
2. **Asks** — numbered checklist of what the board must confirm
3. **CFO recommendation** with rationale link
4. Board reply uses heading `## Board decision: <choice>` + explicit numbered confirmations matching the asks
5. CoS §B grades the closing issue `## CoS Grade: A` when the "full measurement contract + substantive completion evidence" is present.

### 4.4 What gets escalated vs. handled internally

From live thread observation:
- **Internal**: routine recovery, agent reassignment, KPI baseline snapshots, template revisions, cross-agent dependencies (`blockedByIssueIds`), CoS approvals, failure-cluster triage of single-agent clusters.
- **Board-escalated**: anything requiring system-level credentials (Meta Ad Account ID), spend approvals >L2, disk/infra resets, framing decisions where conversion model doesn't exist (e.g. non-USD KPIs ↔ USD), 14+ critical-blocked-48h items piling up, doom-loops where no agent actuator exists.

---

## 5. Anti-patterns (STOP doing these in the fresh start)

### 5.1 Recovery doom-loops (severe — WAV-6623, WAV-6578)

When `Recover stalled issue X` issues fail, Paperclip creates `Recover stalled issue Y` issues for the recovery (WAV-6597 recovers WAV-6578, WAV-6610 recovers WAV-6597, etc.). On disk-full the chain reached depth 3 before the CEO escalated manually. **47 of 108 recovery issues** in the captured window are stuck `blocked`/`backlog`. Fix: cap recovery-chain depth at 2; chain-depth=3 auto-escalates to BOARD with "no agent actuator" framing.

### 5.2 Duplicate Quota-Governor-style spawns (WAV-6541, WAV-6578, WAV-6605, WAV-6619, WAV-6621)

Five identical "Quota Governor: enforce AI process cap" issues were open simultaneously. **113 total Quota-Governor-titled issues across the lifetime** (mostly cancelled). Fix: routine creators must check `issues WHERE title = self.title AND status NOT IN ('done','cancelled')` before POST; the §A throttle gate #1 design (`count > weekly_quota`) is the right shape, apply it to ALL routines not just §A.

### 5.3 Prose-only `measurement_plan` on operator routines (WAV-6599 CEO observation)

> "5 of 9 operator-owned routine cycles ship with prose-only `measurement_plan` ('Run X.mjs', 'Hourly: query Y') rather than SQL. CoS graders score these unmeasurable."

Fix: bake SQL-or-REST-path requirement into the scaffold prompt for routine-owner agents (CDO, CDO/Telemetry, CDO/Signal, Supabase Analyst). The §B grading script literally checks for SQL syntax in the plan; prose-only = automatic F.

### 5.4 CEO accepting `tasks:assign` work outside lane (WAV-2638)

The CEO got assigned a "name blocker + reassign WAV-2317 to Full-Stack Engineer" task but `tasks:assign` is L1 and CEO is L0 in this fleet config. Result: WAV-2638 sat blocked 8 days. Fix: the §A workflow generator must check `assignee.lane_scope.allowed_writes` before POST, not just `assignee.role`. Capability matrix lives at `_shared/agent_capability_matrix.md` (CoS Day 2 artifact, WAV-3424).

### 5.5 Default-routing recovery issues to CEO

Paperclip's "first invokable manager/creator/executive candidate" default routes 130+ recovery issues into the CEO queue. The CEO then triages routing-only work it can't execute. Fix: route recovery to the source-issue's **assignee.manager** first; only escalate to executive tier if the manager also lacks the actuator. This matches the actual decomposition pattern the human-led recoveries use.

### 5.6 "CEO REVIEW REPORT" comment posted as "BOARD" identity

The CEO's heartbeats post as `authorAgentId=df8e265c` (CEO) for some comments and as `authorUserId=local-board` for others (the "BOARD" identity in this report's quotes). Mixed-identity makes audit trails confusing. Fix: single canonical identity per agent role; if the CEO is acting on behalf of the board the comment should still post as CEO with a `# Board-on-behalf-of` heading, not flip to local-board.

### 5.7 Synthetic-inflation contaminating KPI reads (WAV-6533)

> "Synthetic-inflation suspected (`@<TEST_DOMAIN>` test accounts) — real attributable count likely <5"

`new_auth_users_7d` read 7 but the CMO Day-7 wrap had to strip test accounts. Fix: bake a `WHERE email NOT ILIKE '%@<TEST_DOMAIN>'` filter into the official `kpi-fetcher.mjs` and any other test-domain patterns the operator declares.

### 5.8 BOARD_DIRECTIVE batch flooded the queue (WAV-3413 through WAV-3420 + WAV-3666)

Filing 7 simultaneous BOARD directives all `priority=critical` on the same day created a critical-blocked-48h cluster of 14 issues (WAV-6320). The fleet handled it but the surge re-broke the watchdog. Fix: rate-limit board-priority creation to ≤3/day per directive batch; the rest go `priority=high` with a `cohort_id` so they sequence rather than flood.

---

## Quick-reference TL;DR for the wavex-os agent templates

1. **Every workflow issue carries `target_kpi + estimated_delta + measurement_plan (SQL/REST, not prose) + baseline_snapshot`.** Missing any → automatic F. Use the WAV-6388 v1.1 template verbatim.
2. **CEO generates, CoS grades.** No pre-flight gate except `priority='critical'` (2h CoS window, no-response = approval).
3. **Pass condition: `observed_delta ≥ estimated_delta × 0.7`** by default. Overrides need a one-line rationale.
4. **Re-block parents on open children** to silence watchdog wakes. Don't leave parents open during child execution.
5. **Escalations carry `## Required action (Board / user only)`** + Telegram msg ref + deadline + staged fallback issue.
6. **Recovery chain depth = 2** (cap it). At depth 3, auto-escalate as BOARD `[HUMAN]`.
7. **Routine creators must check for duplicate live siblings** before POST. §A throttle gate #1 is the canonical pattern — generalize it.
8. **Capability matrix is authoritative for routing.** Check `assignee.lane_scope.allowed_writes`, not just role, before assignment.
9. **CEO 6h review report is read-only** — surfaces "most-responsible KPI-tier owner" but does NOT spawn work. Generation is §A's contract.
10. **Strip synthetic test-domain rows from KPI reads at the fetcher level**, not per-consumer.

Source corpus: 1,000 issues (2026-04-10 → 2026-05-12), full comment threads on WAV-6373, WAV-6388, WAV-6584, WAV-3420, WAV-2638, WAV-6462, WAV-6623, WAV-6599, WAV-2324, WAV-6533, WAV-3413 plus 16 KPI-tagged issues fetched individually for measurement-contract verification.
