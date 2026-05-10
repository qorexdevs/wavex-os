# SKILL_CANCELLATION_FORENSICS — CRO's diagnostic playbook for the 93% cancel rate

**Effective:** 2026-05-01. **Owner:** WaveX CRO.

## The headline number
**72 of 77 booking_intents are cancellations.** That's a 93% cancel rate. Reported `booking_conversion_rate=<value>%` is a vanity metric on the 11 confirmed bookings; the truth lives in the cancellation cohort.

This skill is **temporary L1 promotion** for the duration of this cycle — read-only against booking_intents + permission to ship ONE deploy: a cancel-reason capture form. After that you're back to L0.

## The diagnostic theorem
Every cancellation is one of:
1. **Price** — sticker shock at checkout, comparison to competitor, no perceived value justification.
2. **Date / availability** — wanted a date that wasn't offered or the offered slot moved.
3. **Scope** — wrong product fit (e.g. solo intent on group-only SKU, group intent on solo-only SKU).
4. **Friction** — payment failure, login required mid-flow, mobile UX broken, form too long.
5. **Trust** — no testimonials, no obvious refund policy, brand-new domain, suspicious copy.
6. **Other** — must be < 15% of cancellations or our taxonomy is broken.

You will collect data to assign every cancellation to one of these 6 buckets. Then propose a fix for the top bucket.

## What to ship (the ONE deploy)

A `cancel_reason_code` capture form. Spec:

- **Trigger:** When a user clicks "cancel" on a booking_intent OR when their session closes with intent in `pending` for > 30min.
- **UI:** Modal with 6 radio buttons (the buckets above) + free-text "tell us more" field. Skippable but encouraged.
- **Data:** New columns on `booking_intents`: `cancel_reason_code` (enum), `cancel_reason_text` (text), `cancel_captured_at` (timestamptz).
- **Implementation owner:** CTO designs the migration + edge function; FSE wires the modal into the React flow. You write the spec + verify the data.

## Heartbeat protocol — 5 steps, no exceptions

1. **Read agent_lessons** (per SKILL_LESSONS_READ.md).
2. **Pull the latest cancellation count + cohort breakdown:**
   ```sql
   SELECT
     status,
     COUNT(*) AS n,
     date_trunc('day', cancelled_at) AS day,
     cancel_reason_code  -- null pre-deploy, populated post-deploy
   FROM booking_intents
   WHERE created_at > NOW() - INTERVAL '30 days'
   GROUP BY status, day, cancel_reason_code
   ORDER BY day DESC;
   ```
3. **Pre-deploy: file the spec for cancel_reason_code capture as an issue** assigned to CTO (`target_kpi=booking_conversion_rate`, `estimated_delta=15`, `measurement_plan` = "after 7 days, cancel rate drops by ≥ 15pp once top bucket is fixed").
4. **Post-deploy: segment the cancel cohort by reason code and post the breakdown.** No more all-72-as-one-blob analysis. Numbers per bucket per day. Trend line.
5. **For the top bucket, file a fix-design issue assigned to CPO + CTO.** Fix proposal in body. Write a measurement plan with prior cancel rate vs target post-fix.

## Forensic queries you'll repeatedly need

```sql
-- Cancellation by SKU (is it a specific product that's leaking?)
SELECT sku_id, COUNT(*) FILTER (WHERE status='cancelled') AS cancels,
       COUNT(*) FILTER (WHERE status='confirmed') AS books,
       COUNT(*) FILTER (WHERE status='cancelled')::float / NULLIF(COUNT(*),0) AS cancel_rate
FROM booking_intents bi LEFT JOIN booking_intent_items bii ON bii.intent_id=bi.id
GROUP BY sku_id ORDER BY cancel_rate DESC;
```

```sql
-- Cancellation by traffic source (is it a specific channel?)
SELECT first_touch_source, COUNT(*) FILTER (WHERE status='cancelled')::float / NULLIF(COUNT(*),0) AS cancel_rate, COUNT(*) AS n
FROM booking_intents WHERE first_touch_source IS NOT NULL GROUP BY first_touch_source ORDER BY n DESC;
```

```sql
-- Cancellation by hour-of-day (signal of friction at certain times — payment processor down? mobile-only?)
SELECT EXTRACT(HOUR FROM created_at) AS hr,
       COUNT(*) FILTER (WHERE status='cancelled')::float / NULLIF(COUNT(*),0) AS cancel_rate,
       COUNT(*) AS n
FROM booking_intents GROUP BY hr ORDER BY hr;
```

```sql
-- Time-to-cancel distribution (instant cancels = friction; slow cancels = price-shopping)
SELECT
  CASE
    WHEN cancelled_at - created_at < INTERVAL '5 minutes' THEN '<5min (FRICTION)'
    WHEN cancelled_at - created_at < INTERVAL '1 hour' THEN '<1h (price/scope shock)'
    WHEN cancelled_at - created_at < INTERVAL '24 hours' THEN '<24h (deliberation)'
    ELSE '>24h (ghosting)'
  END AS cancel_window,
  COUNT(*)
FROM booking_intents WHERE status='cancelled' GROUP BY 1;
```

## Output discipline
- One issue filed per heartbeat (max). Either the deploy spec, the segmentation result, or the fix design.
- Every diagnostic claim attached to a SQL query output (paste the query + first 5 rows).
- No "suggesting we should investigate X" comments. Investigate it in the same heartbeat or don't bring it up.

## What good looks like at end of cycle
- `cancel_reason_code` deployed and capturing data (ground-truth probe: count of non-null codes > 5).
- 72 cancellations partitioned into the 6 buckets with daily count for last 7 days.
- Top bucket has a fix-design proposal in PR or design comment.
- Cancellation rate trended down by ≥ 15pp (e.g. 93% → 78%) for users who saw the fix.

## What bad looks like
- Diagnosing without shipping the capture form (leaving the leak open).
- Filing > 1 issue per heartbeat (you're at L1 conditional, not free reign).
- Proposing a fix without the corresponding bucket count proving it's the highest-leverage bucket.
- Acknowledging the issue without a SQL probe in the same comment.
