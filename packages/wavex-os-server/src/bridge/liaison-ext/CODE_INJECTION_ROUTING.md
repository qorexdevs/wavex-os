# Skill: routing code_change / db_migration injections

The `code-engineer-v1` Expert Agent emits a new class of injection:
`kind = "code_change"` or `kind = "db_migration"`. These are **operational** —
they change the customer's codebase or database — not advisory directives.

Your frozen delivery skill (`SKILL_DELIVER_INJECTION`) only knows the advisory
kinds (`new_issue`, `issue_comment`, `workflow_proposal`, …). It does **not**
handle these. So: **before** you apply the frozen delivery-by-kind logic, check
the kind. If it is `code_change` or `db_migration`, route it here instead.

## Precondition — verify exactly as always

Run the same signature + key-pin verification the frozen skill requires
(`verify-injection.mjs`). An operational injection that fails verification is
REJECTED and dead, same as any other — it never reaches the Git Engineer.

## Routing a verified code_change / db_migration

The payload is a **structured proposal**, not a diff: `{ title, intent,
target_files, target_tables, rationale, acceptance_criteria, risk, rollback,
assignee_role }`. Do not implement it yourself — you are the courier.

1. Find the local **Git Engineer** agent (Phase 9 role; assignee for code
   work). If it exists, file a Paperclip issue **assigned to it**:
   - title: `[CODE-PROPOSAL] <payload.title>`
   - description: the full structured proposal, plus the `source_catalog`
     (`code-engineer-v1`) and the injection id
   - tags: `wavex:code-proposal`, `wavex:expert-issued`, and
     `wavex:db-migration` when `kind = db_migration`
   - The Git Engineer reviews it, has the customer's own eng/CTO agents
     first-pass review it, implements on this box with the customer's own
     GitHub + Supabase creds, and opens a **PR** — PR-only, never
     direct-to-main, never auto-merge.
2. If the Git Engineer role does **not** exist yet on this fleet, do **not**
   drop the proposal. File it tagged `wavex:code-proposal:pending-git-engineer`,
   unassigned, and note in the issue that it needs the Git Engineer role. The
   proposal is real work the customer paid for — it waits, it is not lost.
3. Mark the injection consumed (same PATCH path as every other kind).
4. Record it in the deliverable ledger (`DELIVERABLE_LEDGER` skill) with
   `kind = 'code_change'` or `'db_migration'` so the operational work shows up
   in the unified accountability record alongside everything else.

## Rules

- **You route, you do not implement.** The customer's code is changed only on
  the customer's box, by the customer's own Git Engineer, with the customer's
  own credentials. You never clone a repo, never hold a GitHub token, never run
  a migration. That boundary is the whole privacy model.
- A `code_change` / `db_migration` you cannot route (no Git Engineer, or
  ambiguous payload) is escalated as an issue, never silently delivered as a
  plain `new_issue` — a code proposal mishandled as advisory text is a broken
  promise.
- Never auto-apply. Never merge. PR-only, human + customer-fleet review first.
