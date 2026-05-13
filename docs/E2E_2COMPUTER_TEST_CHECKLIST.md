# End-to-End 2-Computer Test Checklist

The full WaveX OS customer journey, exercised by a fresh laptop against
this Mac mini's inference + Supabase + Stripe stack. Goal: prove every
seam from "git clone" to "first signed injection lands in Paperclip" to
"Privacy Panel shows correct audit trail" to "cancel → access revoked".

Last updated: 2026-05-12

## Roles in this test

- 🖥 **Server Mac** = this Mac mini. Hosts inference-server, OAuth-backed
  Anthropic calls, cloudflared tunnel to `api.wavex-os.com`, the F.5 workers
  for all 4 catalogs.
- 💻 **Client laptop** = the second computer. Acts as a real customer:
  fresh clone, onboarding, Stripe Checkout, hire, runs the Liaison.
- ☁️ **Supabase** = `<your-project-ref>`. Subscriptions, hires, queues, audit.
- 💳 **Stripe** = test mode for this run. Live keys come later.

---

## Pre-flight — Server Mac (one-time, before client connects)

### A. Mac mini inference-server

- [ ] `pnpm --filter @wavex-os/inference-server build` succeeds (produces `dist/index.js`)
- [ ] State dir exists: `mkdir -p ~/.wavex-os/state`
- [ ] All 5 secrets exported in the inference-server's runtime environment
  (set via `launchctl setenv` or `~/.wavex-os/state/.env` — whichever the
  server consumes):
  - [ ] `WAVEX_INFERENCE_SESSION_SECRET` — HS256 secret for Pool A tokens
  - [ ] `WAVEX_LIAISON_JWT_SECRET` — HS256 secret for Pool C JWTs; **must
        match** the same secret in Supabase's `refresh-subscription-jwt`
  - [ ] `WAVEX_SUPABASE_URL` + `WAVEX_SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `WAVEX_ACCEPTED_MANIFEST_HASHES` — comma-list of allowed install hashes
  - [ ] `CLOUDFLARE_TURNSTILE_SECRET` — Pool A captcha verification

### B. Keychain credentials (don't recreate — they're already live)

- [ ] `security find-generic-password -s 'Claude Code-credentials' -w` returns
      JSON with `claudeAiOauth.accessToken` AND `claudeAiOauth.expiresAt > now()`
- [ ] All 8 Expert Agent keys present (4 enc + 4 sign):
  ```bash
  for cid in optimizer-v1 alignment-v1 error-handler-v1 concierge-v1; do
    security find-generic-password -s "wavex-os.expert-agent.$cid" >/dev/null && echo "$cid enc ✓"
    security find-generic-password -s "wavex-os.expert-agent-sign.$cid" >/dev/null && echo "$cid sign ✓"
  done
  ```

### C. Cloudflare tunnel

- [ ] `brew install cloudflared` then `cloudflared login` (interactive)
- [ ] `cloudflared tunnel create wavex-os-mac` → save tunnel UUID
- [ ] `cloudflared tunnel route dns wavex-os-mac api.wavex-os.com`
- [ ] `~/.wavex-os/state/cloudflared.yml` ingress maps `api.wavex-os.com` → `127.0.0.1:8787`
- [ ] `~/.wavex-os/state/cert.pem` + tunnel credentials JSON copied into state

### D. launchd plists loaded

- [ ] Copy from `dist/launchd/*.plist` → `~/Library/LaunchAgents/`
- [ ] `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.wavex-os.inference-server.plist`
- [ ] Same for `com.wavex-os.cloudflared.plist` and `com.wavex-os.resource-sweep.plist`
- [ ] Smoke test all three reachable:
  ```bash
  curl -s http://127.0.0.1:8787/v1/health                    # inference-server local
  curl -s https://api.wavex-os.com/v1/health                  # tunnel + DNS
  tail -f ~/.wavex-os/state/inference-server.log            # no error spam
  ```

### E. Supabase

- [ ] All 7 migrations applied (`supabase/migrations/*.sql`). Verify via MCP:
      `list_tables(schemas=["wavex_os"])` → 10 tables present.
- [ ] 4 catalog rows in `wavex_os.expert_agent_catalog` with non-null
      `recipient_public_key` AND non-null `signing_public_key`.
- [ ] Edge functions deployed:
  ```bash
  supabase login
  supabase link --project-ref <project-ref>
  supabase functions deploy wavex-os-subscription-webhook --no-verify-jwt
  supabase functions deploy create-checkout-session
  supabase functions deploy refresh-subscription-jwt --no-verify-jwt
  ```
- [ ] Edge function secrets set (in addition to auto-injected SUPABASE_*):
  ```bash
  # IMPORTANT: wavex-os reads *_TEST_ENV-suffixed Stripe keys + a dedicated
  # WAVEX_OS_-prefixed webhook secret. This keeps wavex-os subscriptions
  # ISOLATED from wavexcard's existing `stripe-webhook` function (which
  # reads STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET). Re-using those names
  # would make every wavexcard-bookings webhook accidentally also try to
  # parse wavex-os subscription events.
  supabase secrets set STRIPE_SECRET_KEY_TEST_ENV=sk_test_...
  supabase secrets set WAVEX_OS_STRIPE_WEBHOOK_SECRET=whsec_...
  supabase secrets set WAVEX_LIAISON_JWT_SECRET=<same secret as Mac mini>
  ```

### F. Stripe (TEST mode for this run)

- [ ] In Stripe dashboard, switch to **Test mode** (toggle top-right)
- [ ] Run product setup:
  ```bash
  STRIPE_SECRET_KEY=sk_test_... pnpm tsx scripts/billing/setup-stripe.ts
  ```
  Outputs 3 price IDs (founder / growth / custom).
- [ ] Capture the price IDs into `packages/onboarding-ui/.env` as:
  - `VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...`
  - `VITE_STRIPE_PRICE_FOUNDER=price_...`
  - `VITE_STRIPE_PRICE_GROWTH=price_...`
  - `VITE_STRIPE_PRICE_CUSTOM=price_...`
- [ ] In Stripe dashboard → Developers → Webhooks → Add endpoint:
  - URL: `https://<project-ref>.supabase.co/functions/v1/wavex-os-subscription-webhook`
  - Events: `checkout.session.completed`, `customer.subscription.created`,
    `customer.subscription.updated`, `customer.subscription.deleted`,
    `invoice.paid`, `invoice.payment_failed`
  - Copy the `whsec_...` and paste into the `STRIPE_WEBHOOK_SECRET` secret (E above)
- [ ] Stripe Customer Portal configured so customers can self-cancel
      (Settings → Billing → Customer portal → activate)

### G. Decision: keep the seeded test customer, or wipe?

The fixture from `scripts/qa/seed-test-customer.mjs` (subscription
`478fbb24-...`) and the synthetic digest `f92d29e0-...` are training data
per the no-cleanup rule. Leave them in place. The client laptop's run will
create a SECOND, distinct subscription via Stripe Checkout — no overlap.

---

## Pre-flight — Client laptop

- [ ] macOS 13+ or Linux (any), Node 20+, pnpm 8+, git installed
- [ ] Browser with Stripe test-card support
- [ ] **NO secrets needed.** The customer downloads only public code. They
      will create their own subscription via Checkout.
- [ ] A unique email they can receive — for magic-link sign-in to the
      pricing page. Use `+test` suffix if reusing a real inbox.

---

## Phase 1 — Fresh clone

On 💻 client:

- [ ] `git clone https://github.com/<org>/wavex-os.git` (or via `www.wavexcard.com/os` redirect)
- [ ] `cd wavex-os && pnpm install`
- [ ] **CHECKPOINT**: `pnpm install` exits 0. Time it.

## Phase 2 — Boot the local UI + server

- [ ] `pnpm dev` → wait for both:
  - `onboarding-ui` on http://localhost:5173
  - `mock-core` on http://localhost:3101
- [ ] **CHECKPOINT**: Both URLs return 200. Time from `pnpm dev` to ready.

## Phase 3 — Pool A onboarding wizard (proves cross-machine inference)

On 💻 client browser at http://localhost:5173:

- [ ] Click "Get started" — wizard mounts
- [ ] Pillar 1 (company DNA): fill in honestly. Submit.
- [ ] **CHECKPOINT**: T2 enrichment fires. On 🖥 server, tail
      `~/.wavex-os/state/inference-server.log` — should see the
      manifest-hash check pass + the Anthropic OAuth call complete.
- [ ] Pillar 2 (connectors): pick any 2.
- [ ] Pillar 3 (operations): default settings.
- [ ] Pillar 4 (success metrics): default.
- [ ] Activate (Phase 4) — Paperclip handoff fires.
- [ ] **CHECKPOINT**: `~/.wavex-os/instances/default/companies/<new-id>/paperclip-handoff.json`
      now exists on the client. Capture the wavex companyId + paperclip
      companyId.

## Phase 4 — Stripe Checkout

On 💻 client browser, navigate to http://localhost:5173/pricing:

- [ ] Magic-link sign-in with a fresh email; receive + click link
- [ ] Click **Subscribe** on the Growth tier
- [ ] Stripe Checkout opens. Use test card: `4242 4242 4242 4242`,
      any future expiry, any CVC, any ZIP
- [ ] Complete checkout. Browser redirects back.
- [ ] **CHECKPOINT (Stripe)**: Dashboard shows the test customer + 1 active subscription
- [ ] **CHECKPOINT (Supabase)**: `select * from wavex_os.subscriptions where user_id = (select id from auth.users where email = '<your test email>')`
      returns a row with `status='active'` or `'trialing'`
- [ ] **CHECKPOINT (Local)**: `~/.wavex-os/subscription.json` exists with
      `tier='growth'` and either a JWT or empty (bootstrap path)

## Phase 5 — Hire an Expert Agent

On 💻 client, in Mission Control (or wherever HireAgentFlow is mounted):

- [ ] Open the hire panel — 4 agent cards appear
- [ ] Click **WaveX Optimizer**
- [ ] Scope summary shows: `kpi_snapshots`, `open_issue_titles`, `fleet_status`
- [ ] Click **I have read the Processing Agreement** checkbox
- [ ] Click **Confirm hire**
- [ ] **CHECKPOINT**: `select * from wavex_os.hired_expert_agents where subscription_id = '<new sub id>'`
      returns the new hire with `status='active'`

## Phase 6 — Liaison spawn (F.4.f.b)

On 💻 client (Mission Control's onload triggers this automatically; or curl it):

- [ ] `curl -X POST http://localhost:3101/api/billing/ensure-liaison`
- [ ] Response includes `liaison: { status: "spawned", paperclip_agent_id: "..." }`
- [ ] **CHECKPOINT**: `paperclip-handoff.json` now has an `agents['wavex-liaison']` entry
- [ ] **CHECKPOINT**: Paperclip Mission Control on the client shows a new
      `WaveX Liaison` agent in the company's agent list

## Phase 7 — First digest upload

The Liaison runs its SKILL_BUILD_DIGEST + SKILL_UPLOAD_DIGEST on heartbeat:

- [ ] Wait for the Liaison's first heartbeat (or invoke manually via
      Paperclip's `POST /api/agents/<id>/heartbeat/invoke`)
- [ ] **CHECKPOINT (server)**: `select id, received_at, encrypted_fields from wavex_os.fleet_digests where subscription_id = '<sub>' order by received_at desc limit 1`
      returns 1 row with non-null encrypted envelopes addressed to optimizer-v1

## Phase 8 — F.5 worker fires

On 🖥 server, either wait for the scheduler or trigger manually with the new digest:

- [ ] Fetch envelopes + hire_id, pipe into `worker-optimizer-local.mjs`:
  ```bash
  cd /Users/geniex/wavex-os/packages/inference-server
  # Build payload via supabase query → jq, then:
  cat /tmp/client-test-payload.json | node worker-optimizer-local.mjs
  ```
- [ ] Output shows: `decrypted fields: kpi_snapshots, open_issue_titles, fleet_status`
      and `signed Ed25519 (88 chars b64)`
- [ ] Insert injection + usage + audit rows (the worker outputs them; insert
      via Supabase MCP or the inference-server's internal endpoint)
- [ ] **CHECKPOINT**: `select count(*) from wavex_os.injection_queue_v2 where subscription_id = '<sub>' and consumed_at is null` returns ≥ 1

## Phase 9 — Liaison delivers the injection

The Liaison's SKILL_POLL_QUEUE + SKILL_DELIVER_INJECTION fire on heartbeat:

- [ ] **CHECKPOINT (signature pin)**: First-time-use — the Liaison reads the
      `signing_public_key` from `wavex_os.expert_agent_catalog`, pins it
      locally to `~/.wavex-os/state/trusted-keys/optimizer-v1.pub`,
      and verifies the injection signature
- [ ] **CHECKPOINT (Paperclip)**: A new issue appears in the client's
      Paperclip company with `target_kpi=activation_rate` (or whatever
      the worker decided), `priority=high`, and the body from the model
- [ ] **CHECKPOINT (DB)**: `select consumed_at, consumed_by_liaison_id from wavex_os.injection_queue_v2 where id = '<the injection>'`
      shows non-null `consumed_at`

## Phase 10 — Privacy Panel verification

On 💻 client, open Mission Control → Privacy Panel:

- [ ] Panel lists every digest the customer uploaded + every agent that
      read it + the exact field names
- [ ] For the optimizer's run, fields_accessed shows EXACTLY:
      `["kpi_snapshots", "open_issue_titles", "fleet_status"]` — nothing more
- [ ] No other catalog appears (we only hired optimizer)
- [ ] **CHECKPOINT (math claim)**: The customer can verify by SQL:
      `select fields_accessed from wavex_os.digest_access_log where digest_id = '<their digest>'`

## Phase 11 — Cancel + access revoked

On 💻 client browser, open the Stripe Customer Portal link:

- [ ] Cancel the subscription
- [ ] Stripe sends `customer.subscription.deleted` webhook
- [ ] **CHECKPOINT**: `select status from wavex_os.subscriptions where id = '<sub>'`
      now returns `canceled` (or `paused` if at-period-end)
- [ ] Client requests a JWT refresh: `curl -X POST -H 'Authorization: Bearer <old-jwt>' https://<project-ref>.supabase.co/functions/v1/refresh-subscription-jwt`
      → returns 403 `subscription_not_active`
- [ ] **CHECKPOINT (worker)**: Re-run `worker-optimizer-local.mjs` against
      this customer's hire — should skip because the JWT path is gated
      (this is checked at the inference-server boundary, not in the worker;
      worker just reads from queue, but the Liaison can't push more digests)
- [ ] Privacy Panel still shows historical audit rows (data retained for
      training per the no-cleanup rule)

---

## What to capture

### Screenshots
- Wizard at Pillar 1 with email entered (proves the form submitted)
- Pricing page with all 3 tier cards visible
- Stripe Checkout open with the test card filled in
- Hire flow Step 2 — Processing Agreement modal with scope visible
- Mission Control's Privacy Panel showing the audit rows
- Paperclip's company view showing the WaveX Liaison agent + the filed issue

### Timings
- pnpm install duration
- pnpm dev → ready duration
- Wizard total walk time (human-paced)
- Time from "hire confirmed" → Liaison spawned on Paperclip
- Time from "first digest uploaded" → first injection filed in Paperclip

### Costs (from `wavex_os.usage_ledger`)
- Pool A spend during onboarding (T2 enrichment count + tokens)
- Pool C spend per F.5 worker run

### Errors
- Any 5xx from the inference-server log
- Any failed Anthropic call (capture the Anthropic request_id)
- Any failed envelope decrypt (catalog_id + field name)

---

## Failure modes to watch for

| Symptom | Likely cause | Fix |
|---|---|---|
| Wizard T2 enrichment hangs | OAuth token expired on Mac mini | Refresh — `claude` CLI reads same Keychain entry; one `claude --version` heals it |
| Pool A 401 | manifest_hash whitelist mismatch | Add client's current manifest hash to `WAVEX_ACCEPTED_MANIFEST_HASHES` |
| Pool A 429 | Per-email or per-install rate limit | Wait or use a fresh email |
| Stripe webhook silent | Endpoint URL wrong OR webhook secret stale | Re-add endpoint in dashboard; copy new whsec_; restart edge function |
| Hire form submit 4xx | Supabase RLS denies because user not authenticated | Use the magic-link session; check `auth.uid()` returns non-null |
| Liaison spawn 404 | Paperclip URL not set | Export `PAPERCLIP_HANDOFF_URL=http://127.0.0.1:3100` on client |
| Worker decrypt fails | Wrong recipient (catalog mismatch) | Verify Liaison fetched the right catalog's `recipient_public_key` |
| Worker output not JSON | Sonnet wrapped output in fences | Worker already strips fences; check the response_text in stderr |
| Injection signature mismatch on client | Liaison's pinned signing key is stale (catalog rotated) | TOFU pinning means rotation requires manual key swap on client; out of scope for v0 |
| Privacy Panel empty | RLS denies because user_id mismatch | Verify the Supabase auth user owns the subscription |

---

## Out of scope for this run

- Multi-tenant isolation testing (one second-laptop subscription is enough to prove the math; multiple is a load test)
- Live Stripe charges (this entire run is `sk_test_`)
- Custom-tier features (custom is hireable but we test Growth)
- Production cloudflared (this run uses the same tunnel as dev)
- F.5 cron — the worker runs are manual in this checklist. Auto-cron lands later.
- Liaison key rotation (TOFU pin survives but rotation is v2)
- iOS/Android (browser-only)

---

## Sign-off

- [ ] All 11 phases checked
- [ ] Screenshots captured
- [ ] Timings recorded
- [ ] Costs computed from `usage_ledger`
- [ ] Privacy Panel matches `digest_access_log` math
- [ ] One issue filed in client's Paperclip with `target_kpi` set
- [ ] Cancellation revokes Pool C access

When all of the above are checked, F.4 + F.5 are E2E-validated. The
seeded fixture customer (`478fbb24-...`) stays in place per the no-cleanup
rule. The client-laptop's subscription stays in Supabase too — `canceled`
status preserves the audit trail.
