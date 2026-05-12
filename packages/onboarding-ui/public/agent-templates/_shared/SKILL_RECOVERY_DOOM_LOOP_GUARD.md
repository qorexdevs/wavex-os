# Recovery doom-loop guard

**Audience:** every agent. Enforced by a platform-level sweeper, but every agent should understand the rule.

## The failure mode

Paperclip's recovery system spawns "Recover stalled issue X" sub-issues when a parent issue gets stuck. If the spawned recovery issue ITSELF gets stuck, the recovery system spawns another recovery for the recovery. Three layers deep, you have an unbounded tree of "Recover stalled Recover stalled Recover stalled…" — every layer consuming inference budget, none of them making progress against the underlying problem.

A real fleet snapshot showed **47 of 108 blocked issues** were part of recovery doom-loops. Roughly half of the "stuck" surface area was the recovery system fighting itself.

## The rule (sweeper-enforced)

A platform sweeper runs every 30 minutes and applies this rule:

1. **Identify candidates:** issues with `status='blocked'` whose `updated_at` is more than 48h ago.
2. **For each candidate:** check whether it's a child of a recovery chain (any ancestor issue's title starts with `Recover stalled`).
3. **If yes (it's a doom-loop branch):** auto-pause the issue (transition to `cancelled` with a `wavex:doom-loop-pause` system comment). Also auto-pause every ancestor in the chain.
4. **If no:** flag for CoS review with `[POSSIBLE-DOOM-LOOP]` prefix on the next CoS heartbeat.

The sweeper writes its audit trail to `wavex_os.recovery_doom_loop_log` (created in F.1 schema migration).

## What agents should do

- **Do not create a recovery for a recovery.** When `SKILL_RECOVERY_PROTOCOL.md` would have you spawn a recovery issue, check first whether the parent is itself a recovery (title prefix `Recover stalled`). If yes, escalate to the human operator instead — file a `priority='critical'` issue tagged `[HUMAN-ESCALATION]` and stop trying to auto-recover.
- **Do not unblock a `wavex:doom-loop-pause` issue without addressing the root cause.** Reopening the issue tree will re-trigger the loop. If the underlying problem is real, write a NEW issue with a fresh title.

## Configuration

The sweeper's threshold (`48h`) and the chain-depth limit (`2`) can be tuned in `wavex_os.platform_config`:

```sql
SELECT key, value FROM wavex_os.platform_config
WHERE key IN ('doom_loop_pause_threshold_h', 'doom_loop_max_chain_depth');
```

Operator-overridable via Mission Control's settings panel.
