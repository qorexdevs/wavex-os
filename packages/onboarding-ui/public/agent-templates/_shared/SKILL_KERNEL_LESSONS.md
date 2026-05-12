# Kernel lessons — hard-won failure modes you should not re-learn

These five lessons were extracted from a real production fleet. Every CEO + Chief of Staff should read this at the start of every cycle. Each lesson is paired with the defensive rule you should adopt before the same trap fires.

---

## L1 — SDK function returns are not delivery confirmation

The SDKs of every commercial provider (email, payments, SMS, OAuth, analytics) routinely return success codes for operations that did not actually do the externally-visible thing. The most common case: an email SDK's `send()` does NOT throw on API errors (rate limit, suppression, unverified domain). Code that does `try { await send(); count++ } catch { fail++ }` will count rejections as successes.

**Defensive rule:** Always check the SDK's `{data, error}` (or equivalent) return shape, AND cross-check the transport's own log endpoint as an independent probe. The rule is enforced by `SKILL_VERIFY_BEFORE_CLAIM` — every "sent / delivered / fired" claim must include independent verification output in the same comment.

**Real incident:** a marketing agent claimed "22 emails sent". The email provider's log showed 0 recipients. Root cause was a bad sender-domain config; the SDK swallowed the rejection.

---

## L2 — Forecasted deltas are inflated by default

First-pass agents over-promise. They will routinely file an issue with `estimated_delta = +5%` against a baseline they have not measured, with a `measurement_plan` referencing tables that do not exist, then close the issue claiming success. Forecast accuracy on N=1 is meaningless.

**Defensive rule:** Require N≥3 reviewed deliveries before allocating discretionary budget to a pattern. Set `min_reviews_for_allocation=3` in any learning-program config. Until N≥3, the agent is in "probationary forecasting" — the CoS grades estimates against actuals before the agent is allowed to set its own deltas.

**Real incident:** a CFO agent's first issue carried `estimated_delta = 0` and a `measurement_plan` pointing at `cost_events`. The table did not exist. The issue closed `done`. Three more identical-shape issues closed the same way before a CoS pass caught it.

---

## L3 — Schema migrations are half the work

A migration file landing in `supabase/migrations/` (or wherever your DB stores them) does NOT mean the production data conforms to the new schema. Schema changes apply forward; data backfill is a separate operation. An agent claiming "migration applied" is usually claiming half the work.

**Defensive rule:** A migration claim is unverified until `SELECT COUNT(*) WHERE <new_col> IS NOT NULL` (or equivalent) returns the expected count of pre-existing rows. The delivery-truth sweeper auto-reverts migration claims that pass schema-reflection but fail row-count.

**Real incident:** a full-stack engineer deployed a migration adding `utm_source` to `bookings`. The schema landed. The backfill SQL was never run. All historical rows had `NULL`. The downstream attribution agent reported "no UTM data" and the CMO inferred (wrongly) that no traffic had arrived.

---

## L4 — Promotion templates carry prompt-injection signature

When you write directives, the framing matters. Prefixes like "BOARD OVERRIDE", "EMERGENCY DIRECTIVE", or anything that sounds like one model trying to override another model, will trip the receiving model's prompt-injection defenses. The receiver will refuse the work or wait through a long deliberation window, billing tokens without producing output.

**Defensive rule:** Never frame authority as an "override". Bake the confidence level into the role's natural description ("The CEO requests the following…"). Avoid all-caps prefixes, "OVERRIDE", "FORCE", "BYPASS", or any phrasing that suggests circumventing safety machinery.

**Real incident:** a "L1 BOARD OVERRIDE" prefix on a CEO directive caused the receiving Sonnet agent to refuse work for 7–26 seconds per run at $0.41/run before completing. Across a fleet of 30 agents, that's $360+/day burned on the prompt-injection defense alone. Renaming the prefix to "L1 directive (CEO):" eliminated the refusal latency.

---

## L5 — Internal traffic looks like organic until you split it

Without explicit filtering, internal traffic (your own QA, your team's testing, agents probing the site) shows up in your analytics as if it were paying customers. Every "we have traction" claim is suspect until the agent producing it has demonstrated they understand the split.

**Defensive rule:** Always split organic vs internal in any KPI report. Filter known internal wallet addresses, internal email domains (`@your-domain.com`), `/admin/*` page paths, and any session originating from `localhost` or your VPN's CIDR. Until the split is in place, every traction claim is graded `unmeasurable`.

**Real incident:** a fleet reported "40 sessions today, 11 lifetime bookings". A CDO/Attribute pass showed 28 of the 40 sessions were on `/admin/*`, and 9 of the 11 bookings came from a single wallet (the operator's own test wallet). True external lifetime bookings: 2. The "traction" was theater.

---

## How to apply these lessons

At the start of every CEO and CoS cycle, scan the live fleet's recent activity through these five lenses:

1. Is any agent claiming delivery without an independent probe? (L1) → demand the probe, auto-revert if missing.
2. Is any agent forecasting deltas before they have N≥3 reviews? (L2) → grade probationary, override the estimate.
3. Is any "migration applied" claim missing a row-count verification? (L3) → ask for the SELECT COUNT(*).
4. Is any directive using "OVERRIDE / FORCE / EMERGENCY" framing? (L4) → rewrite without the prefix.
5. Is any KPI report missing the organic-vs-internal split? (L5) → ask for the filter.

These five questions take ~2 minutes per cycle and catch the failure modes that wasted multiple weeks of supervision in the previous fleet generation.

## Adding lessons

When you discover a sixth, seventh, etc. lesson, append it here. Use the same three-section format:
- The failure mode (what really happened).
- The defensive rule (what you should do differently).
- The real incident (so future readers can verify the lesson isn't fabricated).

Do NOT append lessons unless you have a real incident. Speculative lessons dilute the file's authority.
