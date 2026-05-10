# Queue Economics — sequence-aware execution for the CEO

Inference time is the scarcest resource. With concurrency=1 and a fixed token budget per 5-hour window, **the order in which work runs determines how much GMV the system books per hour**. FIFO is the wrong default. This skill teaches the order-discipline.

## Three principles

### 1. Sequence the queue by KPI proximity

Every wakeup you fire travels through this priority lattice:

| Field | Highest → Lowest |
|---|---|
| issue.priority | `urgent` → `high` → `normal` → `low` |
| target_kpi tier | T1 (`booking_gmv`) → T2 (`confirmed_bookings_count`, `avg_order_value`) → T3 (`booking_conversion_rate`, `genesis_card_sales`) → T4 (`marketing_events_7d`, `new_auth_users_7d`, `concierge_engagement_rate`) |
| deadline proximity | minutes-to-deadline ascending; missed = highest |
| estimated_delta | bigger Δ first within ties |
| operator level | L2/L3 first, then L1, then L0 |

Board's `tools/priority-scheduler.mjs` automates this re-ranking every 5 minutes via the routine cron entry. You don't reorder by hand — you just **fire wakeups with the right `--reason` and the right `--target-kpi`**, and the scheduler handles the rest.

### 2. Two-layer inference: foreground vs batch

**Foreground tier** (default): items that move the meta-goal directly. T1/T2 KPIs, urgent priority, near deadlines. These run on the current model with concurrency=1.

**Batch tier** (`source: "batch"` on the wakeup): backlog work that doesn't move GMV this week — proposals, audits, exploratory analyses, archive cleanups. These run only when:

- The foreground queue is empty
- Run-success ratio in last 1h ≥ 60%
- Operator's `adapter_config.model` is a Haiku-tier (cheap)

When firing a backlog wakeup that would otherwise dilute foreground capacity, mark it batch:

```bash
node tools/wake-agent.mjs --agent-name "..." --reason "..." --source batch
```

Or in the create-issue flow, set `priority: "low"` and let the scheduler do the routing.

### 3. Dynamic concurrency advisory

`priority-scheduler.mjs` writes `kpi_snapshots._concurrency_recommended` every cycle. Its value is what `MAX_CONCURRENT_CLAUDE_LOCAL` should be set to in the runtime:

| Conditions | Recommended |
|---|---|
| token_health=0 | 0 (pause everything) |
| 1h failed > 5 AND ratio < 0.3 | 0 (pause) |
| 1h ratio < 0.6 | 1 (single-thread, recover) |
| queue depth > 10 | 2 (drain) |
| healthy | 1 (default) |

If the recommended value differs from the live setting, escalate to Board via `SKILL_BOARD_ESCALATION.md` so they can flip the runtime knob.

## What you actually do (per wake)

1. Run preflight (lessons, KPI snapshot).
2. Read latest `_concurrency_recommended` snapshot. If it's 0, **stop** and post a critical comment on the highest-priority open issue: "Inference paused per scheduler recommendation — see snapshot."
3. Otherwise, fire wakeups normally. The scheduler will re-order them within 5 min.
4. When dispatching a wakeup, declare its tier:
   - **foreground** (default): omit `source` or set `source=automation`
   - **batch**: set `source=batch` for low-priority backlog work
5. Never bypass the scheduler by manually re-ordering wakeups.

## DO NOT

- Run >2 concurrent wakeups without first checking the advisory snapshot
- Send a `priority: urgent` wakeup unless the issue truly cannot wait one heartbeat (~6h)
- Mix foreground + batch in the same wake — they have different success criteria

## Why this matters

When tokens are scarce and the meta-goal is $25k GMV in 90 days, each inference second has a dollar value. A T1 issue at urgent priority that ships today is worth ~10× a T4 issue at low priority that ships next week. The scheduler enforces that math automatically.
