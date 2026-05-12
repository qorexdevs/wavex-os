# Phase F.1 — Operator setup

This is the runbook for taking Phase F.1 (Stripe subscriptions + Supabase webhook + pricing page) from code → live. It's written for the WaveX OS operator (you), not end-customers.

Phase F architecture overview lives in [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) and the inline ultrathink note from the planning session. This doc covers only what you have to *do* to ship F.1.

## What F.1 ships

- `wavex_os` Postgres schema in your existing Supabase project (`<YOUR_SUPABASE_PROJECT_REF>`) — 5 tables, RLS enabled
- `stripe-webhook` Supabase edge function — handles checkout + subscription lifecycle
- `create-checkout-session` Supabase edge function — issues Stripe Checkout URLs from the pricing page
- `/pricing` route in `onboarding-ui` — 3 tier cards, Stripe Checkout integration
- Local subscription state file at `~/.wavex-os/subscription.json`
- Billing routes in `op-omega-server` (`/api/billing/subscription*`)

F.1 does **NOT** ship: actual injection generation (F.5), the Liaison agent (F.4), or the slider (F.3). F.1 is the billing rails.

## Prerequisites

- **Stripe account** with API keys (test mode first, live later)
- **Supabase access** to project `<YOUR_SUPABASE_PROJECT_REF>` (you already have this — confirmed via MCP)
- **Domain DNS** — for production, point a subdomain (e.g. `api.wavex-os.com`) at the Supabase project. For dev, the raw `*.supabase.co` URL works.
- `supabase` CLI installed (`brew install supabase/tap/supabase`)
- `pnpm` 8.x

## Step 1 — Apply migrations (already done if reading from main)

```bash
# Both migrations are already applied to <YOUR_SUPABASE_PROJECT_REF> — verify:
# supabase mcp: list_tables(schemas=["wavex_os"]) should show 5 tables
```

The local files at `supabase/migrations/20260511000001_wavex_os_schema.sql` and `20260511000002_wavex_os_rls.sql` are the source of truth for fresh Supabase deployments. If you ever spin up a new project, apply them with:

```bash
supabase link --project-ref <new-ref>
supabase db push
```

## Step 2 — Create Stripe products

```bash
cd <your-wavex-os-checkout>

# Test mode first:
STRIPE_SECRET_KEY=sk_test_... pnpm tsx scripts/billing/setup-stripe.ts

# Output will print 3 price IDs. Save them — they go into onboarding-ui's .env.
```

This creates the 3 plans (Founder $29, Growth $99, Custom $299, all with 14-day trial) on Stripe and prints their price IDs. The script is idempotent — safe to re-run; it looks up by `lookup_key` and skips existing prices.

When you're ready for prod, swap `sk_test_...` for `sk_live_...` and re-run.

## Step 3 — Configure onboarding-ui .env

Create or edit `packages/onboarding-ui/.env`:

```env
VITE_STRIPE_PRICE_FOUNDER=price_...
VITE_STRIPE_PRICE_GROWTH=price_...
VITE_STRIPE_PRICE_CUSTOM=price_...
VITE_SUPABASE_CREATE_CHECKOUT_URL=https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/functions/v1/create-checkout-session
```

## Step 4 — Deploy edge functions to Supabase

```bash
cd <your-wavex-os-checkout>

# Login + link (one-time)
supabase login
supabase link --project-ref <YOUR_SUPABASE_PROJECT_REF>

# Set secrets used by both functions
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...   # filled in after Step 5

# Deploy
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy create-checkout-session
```

`--no-verify-jwt` on the webhook is required because Stripe doesn't send a Supabase JWT — it signs with `STRIPE_WEBHOOK_SECRET`, which the function verifies in code.

`create-checkout-session` keeps JWT verification on because callers (the pricing page) must be signed-in Supabase users.

## Step 5 — Wire the Stripe webhook

In the Stripe Dashboard → Developers → Webhooks → Add endpoint:

- **Endpoint URL:** `https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/functions/v1/stripe-webhook`
- **Events to send:**
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
  - `invoice.payment_failed`

After creation, copy the **Signing secret** (`whsec_...`) and update Supabase:

```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase functions deploy stripe-webhook --no-verify-jwt   # redeploy to pick up new secret
```

## Step 6 — Smoke-test with a real card

```bash
cd <your-wavex-os-checkout>
pnpm dev
```

Open <http://localhost:5173/pricing> → click "Start 14-day trial" on Founder → Stripe Checkout → use test card `4242 4242 4242 4242` + any future expiry + any CVC → submit. You should land back on `/pricing?session_id=...&success=1`, and the polling loop fetches your subscription state from Supabase.

Verify in Supabase (via MCP or dashboard SQL):

```sql
select user_id, tier, status, current_period_end
from wavex_os.subscriptions
order by created_at desc
limit 5;

select id, type, processing_error
from wavex_os.stripe_webhook_events
order by processed_at desc
limit 5;
```

You should see one row in `subscriptions` (`tier=founder, status=trialing`) and at least one event in `stripe_webhook_events` (no `processing_error`).

## Step 7 — Verify the local subscription file

```bash
cat ~/.wavex-os/subscription.json
```

Should show your `tier`, `status: "trialing"`, the `jwt` (signed by `api.wavex-os.com` later in F.4 — for now, this field will be empty until we wire JWT issuance).

## Step 8 — Production checklist

Before flipping to live mode:

- [ ] Replace `sk_test_...` with `sk_live_...` in Supabase secrets
- [ ] Re-run `setup-stripe.ts` against live mode to create production price IDs
- [ ] Update `packages/onboarding-ui/.env` with the new live price IDs (rebuild + redeploy UI)
- [ ] Add a **production** webhook endpoint in Stripe Dashboard pointing at the same URL but using a new signing secret
- [ ] Enable **Stripe Tax** (Settings → Tax → Enable) — $2 per successful charge but handles international VAT automatically. Skip at your peril.
- [ ] Add the customer's email to the Stripe customer object so receipts reach them (already handled in `create-checkout-session/index.ts`)
- [ ] Set up Stripe → Slack/Telegram alerts on `charge.failed` and `invoice.payment_failed`
- [ ] Review the customer billing portal (Stripe Dashboard → Settings → Billing → Customer portal) — make sure cancel-anytime is enabled

## Pricing economics — what to monitor

Per the ultrathink session, Growth tier ($99/mo) costs roughly:

- ~10 injections/day × ~10K tokens each = 100K tokens/day = ~$45/mo at Anthropic API rates
- ≈ 55% gross margin

This is workable but tight. Track in production:

1. **Cost per active subscription per day** (from `wavex_os.optimizer_runs.cost_cents` summed daily)
2. **Injection conversion** — % of injections that result in a measurable KPI delta
3. **Churn** — cancel-rate per cohort

If cost-per-sub exceeds 50% of revenue for any tier, either:
- Bump pricing
- Reduce injection size (smaller prompts, more aggressive prompt caching)
- Tier-down the model (Haiku for low-priority injections)

## Open issues blocking F.2

These are known gaps in F.1 that F.2+ closes:

- **JWT issuance.** Local `subscription.json.jwt` is empty in F.1 — F.4 wires the issuance flow.
- **`wavex_os_subscription_by_checkout` RPC.** Referenced in `billing.ts` but not yet defined — needs a Postgres function that joins `subscriptions` ⋈ `stripe_webhook_events` by `session_id`. Adding in F.1.b.
- **Pricing page auth.** `create-checkout-session` requires a Supabase JWT but the pricing page doesn't have a sign-in flow yet. Right now you must manually log in via Supabase Auth UI before testing — to be addressed in F.1.b with a `/auth` route.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Price ID not configured` error on Pricing page | `.env` missing | Set `VITE_STRIPE_PRICE_*` and restart dev server |
| Webhook returns 400 | Bad signature | Verify `STRIPE_WEBHOOK_SECRET` matches the endpoint's signing secret |
| Subscription row never appears | Webhook not configured or `user_id` missing | Check Stripe Dashboard → Webhook → Events tab. Look for `client_reference_id` in checkout.session.completed |
| `wavex_os.touch_updated_at` advisor warning | search_path mutable | Already fixed in `20260511000001` |
