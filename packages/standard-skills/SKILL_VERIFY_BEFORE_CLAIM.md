# SKILL_VERIFY_BEFORE_CLAIM — meta-cognition rule

**Audience:** every agent in a WaveX OS fleet.
**Why this exists:** in field-testing across multiple companies, we observed the same failure mode repeatedly. A marketing agent claimed "22 emails sent"; the transport log showed 0. A finance agent published an "audit complete" report on a table that didn't exist. A CEO graded a migration as "columns missing"; the columns were live, only the backfill was missing. SDKs that don't throw on transport failures + agents that "trust" the function return = silent fictional output that consumes inference budget AND hides the real blocker.

## The probe contract

Before posting any of these phrases in an issue comment:

- "sent", "delivered", "fired", "blast went out"
- "deployed", "applied", "live", "shipped"
- "audit complete on `<table>`"
- "migration applied", "columns added"
- "campaign live", "outreach complete"

**you must include in the same comment a ground-truth probe and its output.** No exceptions. Especially not when you "trust" the function return.

Pick the closest probe match:

| Claim type | Required probe | Where to put output |
|---|---|---|
| Sent N emails / blast | Query the email transport log for messages created since your run start, list recipient `to` fields, exclude internal/admin notifications | "**Transport verification:** N actually delivered to recipients X, Y, Z. Internal notifications excluded." |
| Migration applied / columns added | Query the live database schema for the target table; reflect column names | "**Schema verification:** columns `a, b, c` present on `<table>`. Migration file SHA: `<hash>`." |
| Audit on table | Confirm the table exists by hitting your data API and getting 200 not 404 | "**Table existence verified:** `<table>` returned 200." |
| Code change deployed | `git rev-parse HEAD` of the relevant repo + check the deploy workflow ran | "**Deploy verification:** commit `<sha>`, workflow run `<id>` succeeded." |
| Issue / comment created | Quote the actual ID returned by the API call you just made | "Comment `<uuid>` created." |
| Campaign live | Cross-check at LEAST TWO independent sources: marketing event row + transport log + UTM-tagged landing page hit | "**Three-source verification:** event `<id>`, transport `<msg_id>`, landing page `<utm>` first_seen `<ts>`." |

## What happens if you skip the probe

A delivery-truth detector runs every ~10 minutes against your most recent comments. If it finds a delivery claim without supporting evidence — OR if the claim contradicts the underlying transport — it will:

1. Log a CRITICAL `agent_lessons` row on you (visible to all future runs of yours via the preflight)
2. Auto-revert the issue from `done`/`in_review` back to `in_progress`
3. Stamp a board comment on the issue: "auto-revert by delivery-truth"

Repeated overattestation triggers a confidence-level demotion via CEO review.

## Why this is non-negotiable

Every false-positive "shipped" delays the next real action by an entire heartbeat cycle. The board cannot grade impact if the claim was fictitious. **Fictional output is worse than no output** because it consumes inference budget AND hides the real blocker.

## When you can't verify

If the verification probe is genuinely blocked (no API key, no read access, table not yet created), DO NOT claim "sent/done/applied". Post status as `blocked` with a `### BLOCKED — need <thing>` header so your supervisor can route. Honest blocks are graded `unmeasurable` (no penalty); false claims are graded `regression` (demotion).
