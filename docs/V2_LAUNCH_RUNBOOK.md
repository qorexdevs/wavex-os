# V2 Launch Runbook

A step-by-step path from "fresh clone" or "post-wipe state" to "first V2 fleet running + first paying subscriber". 2026-05-12.

This runbook assumes you've read [`docs/V2_MANIFEST.md`](./V2_MANIFEST.md) and the three capture docs.

---

## Where this picks up

After the 2026-05-12 wipe:

- ✅ Legacy company `<LIVE_COMPANY_ID>` and its 49 GB of state are gone.
- ✅ All 10 Paperclip launchd jobs unloaded; plists removed from `~/Library/LaunchAgents/`.
- ✅ V2 agent templates landed on main with: `SKILL_VERIFY_BEFORE_CLAIM`, `SKILL_KERNEL_LESSONS`, `SKILL_ROLE_COLLAPSE`, `SKILL_RECOVERY_DOOM_LOOP_GUARD`, `SKILL_KPI_SYNTHETIC_FILTER`, plus role-skill updates.
- ✅ System Reliability agent role added.
- ✅ Inference-server scaffold at `packages/inference-server/`.
- ✅ Pricing page with magic-link sign-in.
- ✅ Supabase wavex_os schema applied + `wavex_os_subscription_by_checkout` RPC live.
- ✅ Forensic snapshot at `~/.wavex-os/legacy-snapshot-2026-05-12/` (NOT committed).

What's left: real Pool A wiring (G.3.b), Liaison agent (F.4), Pool C generation (F.5), Stripe credentials, first real onboarding.

---

## Step 1 — Smoke-test the current build

```bash
cd ~/wavex-os
pnpm install
pnpm -r --filter "./vendor/wavex-os/*" build
pnpm --filter @wavex-os/wavex-os-server typecheck
pnpm --filter @wavex-os/onboarding-ui build
pnpm --filter @wavex-os/inference-server typecheck
```

All four should pass. If anything fails, stop here and surface to the team.

Run the audit:

```bash
node apps/installer/bin/init.js audit
```

You should see:
- Disk green
- Swap whatever (yellow/red is fine if you've been running heavy workloads recently)
- All services not listening (expected — nothing's started)
- No launchd jobs loaded

---

## Step 2 — Provision Stripe (one-time)

```bash
# Test mode first
STRIPE_SECRET_KEY=sk_test_... pnpm tsx scripts/billing/setup-stripe.ts
```

Copy the three printed price IDs into `packages/onboarding-ui/.env`:

```env
VITE_STRIPE_PRICE_FOUNDER=price_...
VITE_STRIPE_PRICE_GROWTH=price_...
VITE_STRIPE_PRICE_CUSTOM=price_...
VITE_SUPABASE_URL=https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJI...
VITE_SUPABASE_CREATE_CHECKOUT_URL=https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/functions/v1/create-checkout-session
```

---

## Step 3 — Deploy Supabase edge functions

```bash
supabase login
supabase link --project-ref <YOUR_SUPABASE_PROJECT_REF>

supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...   # filled after step 4

supabase functions deploy wavex-os-subscription-webhook --no-verify-jwt
supabase functions deploy create-checkout-session
```

`--no-verify-jwt` on the webhook because Stripe signs with `STRIPE_WEBHOOK_SECRET`, not Supabase JWT.

---

## Step 4 — Wire the Stripe webhook

In Stripe Dashboard → Developers → Webhooks → Add endpoint:

- **URL:** `https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/functions/v1/wavex-os-subscription-webhook`
- **Events:** `checkout.session.completed`, `customer.subscription.*` (3 events), `invoice.paid`, `invoice.payment_failed`

Copy the new signing secret (`whsec_...`) → `supabase secrets set STRIPE_WEBHOOK_SECRET=...` → redeploy the webhook function.

---

## Step 5 — Smoke-test the pricing page

```bash
cd ~/wavex-os
pnpm dev
```

Open <http://localhost:5173/pricing>. You should see:

- The three plan cards (Founder $29, Growth $99, Custom $299).
- A "Sign in to subscribe" widget at the top.

Enter your email → click "Send magic link" → check inbox → click link → you land back at /pricing with "Signed in as you@…". Click "Start 14-day trial" on Founder → Stripe Checkout opens with test card field → enter `4242 4242 4242 4242` + any future expiry + any CVC → submit. Redirected back to `/pricing?session_id=...&success=1`. Watch the page poll for ~30s, then redirect to `/?subscribed=1`.

Verify the Supabase row:

```sql
select user_id, tier, status, current_period_end
from wavex_os.subscriptions
order by created_at desc
limit 5;
```

Should show your row with `tier='founder'`, `status='trialing'`, `current_period_end` ~ 14d out.

Verify the local subscription file:

```bash
cat ~/.wavex-os/subscription.json
```

---

## Step 6 — Render + load V2 launchd jobs

```bash
# Copy the example and fill in
cp examples/wavex-os.config.example.json wavex-os.config.json
$EDITOR wavex-os.config.json   # set companyId after activate; for now use placeholder

node scripts/render-launchd-templates.mjs
launchctl load -w ~/Library/LaunchAgents/com.wavex-os.*.plist
launchctl list | grep wavex-os
```

This activates:
- `resource-sweep` — every 15min disk/RAM cleanup + monitoring
- `inference-server` — Fastify on :8787 (currently returns G.3 stubs until G.3.b wires Anthropic)
- `cloudflared` — public surface via `api.wavex-os.com` (you'll need to do the tunnel-create + DNS-route steps in `packages/inference-server/README.md` first)
- plus the existing legacy jobs (attribution-sweep, bottleneck-digest, etc.)

Re-run `node apps/installer/bin/init.js audit`. The "launchd jobs" check should now go green.

---

## Step 7 — First V2 onboarding (fresh company)

This is the real test. Walk the wizard.

```bash
# pnpm dev should still be running. If not:
pnpm dev
```

Open <http://localhost:5173/onboarding?t0=1>. Walk through:

1. **Pillar 1** — pick a company name + tell the wizard what you're building. The new templates apply.
2. **Pillar 2** — verify Claude CLI + plan tier.
3. **Pillar 3** — pick a stage. **If you pick `pre_product` or below `100k_mrr`, the wizard will use the new `SKILL_ROLE_COLLAPSE` table to ship a 6-role collapsed roster instead of the formal 9-role C-Suite.** This is the V2 default.
4. **Pillars 4 + 5** — GTM + Comms.
5. **Phase 2** — Connectors decision matrix.
6. **Phase 3** — Swarm. The reactflow chart should show ~12 agents for collapsed-6 stage (incl. CEO+CoS+MarketingOps+FullStack+Recovery+SystemReliability + L·IV specialists).
7. **Phase 4** — Workflow allocation.
8. **Finalize** — Click "Finalize + sign". Wait for Monte Carlo. Then "Activate fleet".

After activate, **the new Ignition phase fires automatically**. The response includes `ignition: { status, agents_working, workflows_queued, goal_id, ... }`. Check the Mission Control banner — it should show GREEN "Fleet ignited — N agents working".

If ignition went YELLOW/RED, hit the re-run endpoint:

```bash
curl -X POST http://127.0.0.1:3101/api/instance/<companyId>/ignite
```

---

## Step 8 — Watch the System Reliability agent

The new System Reliability agent should be running in the freshly-onboarded fleet. After ~15min, the platform-level `resource-sweep.sh` cron fires its first cycle. Logs at:

```bash
tail -f ~/.wavex-os/state/resource-sweep.log
```

You should see something like:

```
2026-05-13T01:00:00Z disk_pct=14
2026-05-13T01:00:01Z ram_pressure_mbps=0.2
2026-05-13T01:00:02Z done disk=14% -> 14% (freed=0pp) ram=0.2 actions=none
```

If anything turns yellow/orange/red, the System Reliability agent files an issue + (if configured) pings your Telegram.

---

## Step 9 — Verify Paperclip handoff still works

If `PAPERCLIP_HANDOFF_URL` is set in your environment, activate should also mirror the 35 agents into a Paperclip company. Visit `http://127.0.0.1:3100` to confirm.

If Paperclip isn't running, activate succeeds anyway — just without the mirror. Mission Control on the wavex side still works.

---

## Step 10 — First real test (24h soak)

Leave it running for 24h. Don't touch it.

What you should see at the end:

- **System Reliability agent's `host_disk_used_pct` KPI** has 96 snapshots (4/hour × 24h).
- **CEO's Goal Keeper §A** fired once at 09:07 your-tz time. One directive filed.
- **CoS's §B hourly grader** ran 13 cycles (9am-9pm × 1 weekday). Some issues graded A, some B, some F.
- **No disk pressure events** because System Reliability + resource-sweep are catching artifacts before they accumulate.
- **No doom-loops** because `SKILL_RECOVERY_DOOM_LOOP_GUARD` auto-paused any blocked-48h chain.

If any of these are off, the V2 design has a real gap — file an issue, capture, iterate.

---

## What's NOT in this runbook

- **F.4 Liaison agent + F.5 Pool C generation.** Currently the optimizer endpoints return 503 stubs. Customers paying for Growth/Custom tiers will see "Optimizer: connecting…" with no actual injections delivered. This is shipped intentionally — you can collect customer payment and validate willingness to pay before building the optimizer.
- **G.3.b — real Pool A wiring.** The inference-server's `/v1/onboarding/t2` returns a 503 stub. The wizard's Pillar 1 enrichment falls back to T1 deterministic mode. Quality is ~70% of LLM enrichment — fine for early customers, lift after first 5 signups.

---

## When to migrate off the Mac (per V2_CAPTURE_C §7)

Trigger conditions:
1. 30+ paying subs on Pool C
2. >2 unplanned outages in 30 days
3. Anthropic asks you to stop reselling Max

Migration target: Hetzner CCX13 ($13/mo) or Fly.io. Runbook lives at V2_CAPTURE_C §7.

Until those triggers fire, ship from the Mac.
