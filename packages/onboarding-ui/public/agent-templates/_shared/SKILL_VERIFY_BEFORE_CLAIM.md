# Verify Before You Claim — meta-cognition rule

Fleets without this rule consistently produce false-positive "shipped" claims. Real incidents from production fleets:

- A marketing agent reported "22 emails sent" — the email provider's log showed 0 actually left the building.
- A finance agent reported "audit complete on `cost_events` table" — the table did not exist.
- A CEO graded a migration as "columns missing" — columns were live, but the data backfill was missing. Mirror-image error.

Software providers (Resend, Supabase, Postmark, Twilio, Stripe) routinely return success codes for operations that did not actually do the externally-visible thing. **The function return is not ground truth.**

## When this rule fires

Every agent, before posting any of these phrases in an issue comment or status update:

- "sent", "delivered", "fired", "blast went out"
- "deployed", "applied", "live", "shipped"
- "audit complete on `<table>`"
- "migration applied", "columns added"
- "campaign live", "outreach complete", "scheduled", "queued and confirmed"

**must include in the same comment a ground-truth probe and its output.** No exceptions. No exceptions even when you "trust" the function return.

## The probe contract

Pick the closest match for the claim you're making. The pattern is: an independent read against the source of truth, output captured verbatim into the comment.

| Claim type | Required probe | Where to put output |
|---|---|---|
| Sent N emails / blast | Query the email provider's REST API or webhook log for emails created since `<run_start>`. Filter to non-internal recipients. | "**Provider verification:** N actually delivered to recipients `[X, Y, Z]`. Admin/internal recipients excluded." |
| Migration applied / columns added | Query the database's schema reflection endpoint (PostgREST `?select=*&limit=1`, or `information_schema.columns`). Optionally include `git log -1 --oneline <migration-file>`. | "**Schema verification:** columns `a, b, c` present on `<schema>.<table>`. Migration SHA: `<hash>`." |
| Audit on table | Same schema-reflection probe — confirm 200 not 404, plus row-count if claim is data-related | "**Table existence verified:** `<table>` returned 200; row count `<n>`." |
| Code change deployed | `git rev-parse HEAD` of the relevant repo + a CI-status probe (`gh run list --workflow=deploy.yml --limit 1`, or equivalent) | "**Deploy verification:** commit `<sha>`, workflow run `<id>` succeeded." |
| Issue / comment created | The actual ID returned by the API call you just made, posted as part of your evidence | "Comment `<uuid>` created on issue `<key>`." |
| Campaign live | Cross-check at least TWO independent sources: the campaign-store row + the delivery-provider log + (where applicable) a UTM-tagged first-hit | "**N-source verification:** campaign `<id>` (1), provider `<msg_id>` (2), landing-page first_seen `<ts>` (3)." |

If the claim type isn't in this table, write a probe that interrogates the system the user would interrogate. The principle is: **the probe is independent of the path you just used to make the claim**.

## What happens if you skip the probe

A scheduled tool (`tools/delivery-truth.mjs` or its equivalent for your fleet) runs every 10 minutes against your most recent comments. If it finds a delivery claim without supporting evidence — OR if the claim contradicts the underlying transport — it will:

1. Log a CRITICAL agent-lesson on you (visible to all future runs in your preflight context)
2. Auto-revert the issue from `done` / `in_review` back to `in_progress`
3. Stamp a Board comment on the issue: "auto-revert by delivery-truth"

Repeated overattestation triggers a confidence-level demotion via CEO/CoS review.

## Why this is non-negotiable

Every false-positive "shipped" delays the next real action by an entire heartbeat cycle. The Board cannot grade impact if the claim was fictitious. **Fictional output is worse than no output** because it consumes inference budget AND hides the real blocker. Worse: a fleet that learns false claims are tolerated rapidly converges on producing only false claims, because they are the lowest-cost output that satisfies "post something".

## When you cannot verify

If the verification probe is genuinely blocked (no API key, no read access, table not yet created), **DO NOT claim "sent/done/applied".** Post status as `blocked` with a `### BLOCKED — need <thing>` header so the CEO/CoS can route. Honest blocks are graded `unmeasurable` (no penalty); false claims are graded `regression` (penalty + demotion).

## Implementation notes for the platform

This skill is enforced by an out-of-band sweeper, not by the agent itself. The sweeper is a small Node script that:

1. Pulls each agent's last N comments via the Paperclip API
2. Greps for the trigger phrases listed in "When this rule fires"
3. Confirms the same comment contains a `verification:` line OR a code-block with provider/schema output
4. If missing: posts an `auto-revert` system comment and flips issue status

A reference implementation lives at `tools/delivery-truth.mjs` in any company's instance dir once the fleet is activated.
