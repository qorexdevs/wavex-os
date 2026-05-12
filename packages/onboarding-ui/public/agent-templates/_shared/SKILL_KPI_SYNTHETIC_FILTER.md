# KPI synthetic-data filter

**Audience:** every agent that reads or writes KPI values. Paired with `SKILL_KPI_OWNERSHIP.md` and `SKILL_VERIFY_BEFORE_CLAIM.md`.

## The failure mode

Without explicit filtering, your own QA traffic, internal team accounts, agent-driven test runs, and wallet/email addresses used for development all show up in KPI reads as if they were paying customers. A fleet that reports "11 lifetime bookings" while 9 of them came from the founder's own test wallet has not measured anything real — but every downstream decision (hire more sales? scale up ads?) is being made off that false signal.

The pattern repeats across every KPI surface:
- New-user count is inflated by `@your-team-domain.com` email addresses
- Booking GMV is inflated by internal test wallets / test card numbers
- Session counts are inflated by `/admin/*` page hits
- Concierge message volume is inflated by the agents themselves probing the bot

## The contract

Every KPI query MUST exclude known synthetic-data sources before reporting the value. This is enforced at query-construction time, not after-the-fact filtering.

### The required filter clauses

When writing a KPI query, append the filters that apply to its data source:

| Data source | Required exclusion clause | Reason |
|---|---|---|
| `auth.users` / any user table | `AND email NOT ILIKE ANY (ARRAY['%@<your-team-domain>.com', '%@<test-team-domain>.com'])` | Internal team emails |
| `auth.users` | `AND (is_anonymous = false OR is_anonymous IS NULL)` | Anonymous Supabase sessions are not real signups |
| Wallet / payment | `AND wallet_address NOT IN (SELECT addr FROM wavex_os.internal_wallets)` | Test wallets used for QA |
| `marketing_events` / sessions | `AND path NOT LIKE '/admin/%' AND path NOT LIKE '/test/%'` | Internal traffic paths |
| Concierge / chat volume | `AND user_id NOT IN (SELECT id FROM auth.users WHERE email ILIKE ANY (...))` | Internal users chatting with the bot |
| Bookings / orders | `AND user_id NOT IN (SELECT id FROM auth.users WHERE email ILIKE ANY (...))` | Internal test orders |

The exact list of synthetic-data sources is per-company. The wizard's Pillar 5 (Comms) collects:
- Your team's email domain
- The wallet addresses you use for testing (optional)
- The `/admin` path prefix (defaults to `/admin/`)

These get written to `wavex_os.synthetic_data_filters` at activate time, and the SQL the agents generate consults that table.

## What you do when you can't filter

If the table you're querying does not have a column to filter on (e.g. third-party analytics with no per-user attribution), you have two options:

1. **Time-bound the report.** Only count entries since you confirmed all internal team accounts were excluded (e.g. "since 2026-05-12, the date we registered the synthetic filter").
2. **Mark the metric `internal_contaminated` in your report.** Do NOT use the raw number as a KPI. Use it only as a directional hint, and only after a `SKILL_VERIFY_BEFORE_CLAIM` probe confirms the data exists at all.

Never report a "we have traction" claim from an unfiltered or uncertain source. This is a regression-grade offense per CoS rubric.

## Maintenance

Whenever you (a person or an agent) add a new test account, new test wallet, or new internal email pattern, run:

```sql
INSERT INTO wavex_os.synthetic_data_filters (kind, value, note, added_at)
VALUES ('email_domain', '@new-test-domain.com', 'QA team Slack signup', NOW());
```

Filters are additive only. Removing a filter requires a CoS-approved issue with justification.
