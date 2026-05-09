# SKILL_RECOVERY_PROTOCOL — cold-start runbook for CEO + Chief of Staff

**When this fires:** wake context includes `wake_reason=recovery_protocol:*`. The recovery service has already snapshotted state and (for safe actions) auto-executed. Your job is to ratify the queued approvals and resume coherent execution.

## What the recovery service already did (auto, safe)

1. Probed OAuth health; refreshed if expired and the refresh token still valid.
2. Ran the attribution sweep (catches issues that closed during the outage).
3. Recomputed bottlenecks.
4. Filed board approvals for RISKY actions (zombie kills, error-agent restarts).
5. Woke you with `recoverySnapshotShort` in the wake payload.

## What you need to do (in order)

### CEO playbook (60–90 seconds)

1. **Read `recoverySnapshotShort`** from your wake payload. Note: zombie issue count, error agent count, top bottleneck.
2. **List pending approvals:** `GET /api/companies/{COMPANY_ID}/approvals?status=pending` — find any titled `Recovery Protocol — *`.
3. **For each Recovery Protocol approval:**
   - Read the `payload.issueIds` (zombies) or `payload.title` (error agents).
   - **Ratify (approve):** if the recommendation matches your judgment, approve. The CEO/board can execute the kills/restarts in a follow-up.
   - **Reject + reroute:** if specific items shouldn't be killed, reject the bulk approval and file a narrower one with the right subset.
4. **Don't** spawn fresh delegations on this heartbeat. Recovery is about closing loops, not opening new ones. The next routine heartbeat (regular cycle) is when new work starts.
5. **Closing line:**
   ```
   ARTIFACT: approve|kill|escalate <approval link>
   RECOVERY: <ratified|rejected|partial> — <count> issues addressed
   NEXT: monitor next heartbeat for flow resumption
   ```

### Chief of Staff playbook (60 seconds)

1. **Read `recoverySnapshotShort`** for the bottleneck and error agent fields.
2. **Identify the ONE recovery-specific alignment issue:**
   - If error agents are clustered in one team (e.g., 3+ agents under same manager), that's a structural issue → propose a scoped restart approval.
   - If the top bottleneck KPI's owner is in error state, that's the highest-leverage fix → propose explicitly.
3. **File ONE approval** distinct from CEO's batch approvals. Don't duplicate.
4. **Closing line:**
   ```
   ALIGNMENT_DECISION: approve|noop
   NEXT: board to ratify; resume normal 4h cadence
   ```

## What to do if the snapshot is empty or stale

If `serverUptimeSeconds < 120`, the recovery service ran during cold-start before any data could be observed. Exit cleanly:
```
ARTIFACT: noop
RECOVERY: snapshot_too_early — server uptime <2min, no actionable signal
NEXT: wait for next routine wake
```

## Hard limits during recovery

- **Don't** auto-fire delegations. Recovery is closing-loop only.
- **Don't** start new cycles or directives during the recovery wake.
- **Don't** duplicate approvals from each other (CEO and Chief of Staff). Each makes ONE decision specific to their role.
- Max 5 comments total during the recovery heartbeat.

## Why this exists

After a host shutdown / OAuth cluster failure / server crash, the heartbeat-recovery loop will mechanically respawn agents to their inboxes — but they don't know that the system was down. They'll resume work mid-stream, often on stale assumptions, and the result is fleet thrash. This protocol gives you the snapshot needed to make discrete recovery decisions instead of letting the fleet drift back into motion.
