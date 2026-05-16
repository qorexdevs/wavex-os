# Lovable Agent Prompt — WaveX OS Device-Pair + Pre-Console Flow

Follow-up to `docs/LOVABLE_CONSOLE_PROMPT.md`. Paste the section below the
line into the Lovable agent on the same project (`wavex-experience-architect`,
hosts `wavexcard.com`). It already built `/os/console` + `/os/admin` per the
earlier prompt. This handles the **pre-console journey** — the surface a
customer goes through BEFORE they ever land in the console.

The immediate trigger: a real paying customer just hit
`WaveX ran into an error — UiConfigContext must be present in root` on
`https://wavexcard.com/os/link?code=UVEZ-97XY`. The page is crashing because
it's missing a required React provider. Customer cannot complete device
pairing → cannot start using wavex-os → cannot keep paying. P0.

---

## PROMPT FOR THE LOVABLE AGENT

You shipped `/os/console` and `/os/admin` per the earlier prompt — solid.
This is the **pre-console flow**: every surface a customer touches before
their first console visit. Right now the `/os/link` page is **crashing in
production** on a real paying customer, and at least one upstream page in the
journey is likely empty or broken too. Fix the journey end-to-end.

### The full customer journey you own (in order)

```
1. Customer visits  wavexcard.com/os                     →  marketing + sign-in
2. Clicks Get Started                                    →  /os/pricing
3. /os/pricing                                           →  3 tier cards + Stripe Checkout
4. Stripe Checkout                                       →  hosted, then redirects back
5. /os/checkout-success?session_id=cs_...                →  "you're subscribed → install"
6. Customer installs wavex-os, runs `wavex-os login`     →  CLI prints pair code XXXX-YYYY
7. /os/link?code=XXXX-YYYY                               →  confirm-pair page
8. /os/console                                           →  (already built)
```

Steps 1–7 are what you need to fix / finish. Steps 8 is already shipped.

### THE BUG that's blocking a real customer RIGHT NOW

`https://wavexcard.com/os/link?code=UVEZ-97XY` renders the global error
boundary with literal text:

```
WaveX ran into an error
UiConfigContext must be present in root
```

Whatever route component renders `/os/link` is reading `useUiConfig()` (or
similar) without being wrapped in the `UiConfigProvider` that the rest of the
app uses. Either:

- the route is mounted OUTSIDE the provider tree in the router config, or
- the component imports a context hook from a different file than the provider
  is exported from, or
- the route is being rendered before the provider has hydrated

**Find it, wrap it, and verify the page renders without crashing for an
unauthenticated visitor AND for an authenticated user.** This is the single
highest-priority fix in this prompt.

### What `/os/link` must do (the device-pair confirm page)

This page is the second leg of an OAuth 2.0 device-flow handshake. The CLI on
the customer's machine has already created a `pending` pairing row; the
customer's browser is what authorizes it.

1. **Read `code` from the URL query.** Format: `XXXX-YYYY` (8 letters/digits
   with a hyphen — uppercase, no ambiguous chars). If missing, show a manual
   "enter your pair code" input instead.

2. **Require Supabase auth.** If `supabase.auth.getSession()` returns null,
   render your existing sign-in widget. After sign-in, keep the `code` in the
   URL so the redirect lands back here.

3. **Look up the pairing.** Call the public RPC `os_lookup_pairing(_user_code)`
   via `supabase.rpc('os_lookup_pairing', { _user_code: code })`. It returns
   one row: `{ id, hostname, os_version }`. If empty → "Code expired or
   invalid. Run `wavex-os login` again on your machine."

4. **Show device confirmation.** Render a card with:
   - Big visual confirmation of the code (so user verifies it matches their
     terminal)
   - `hostname` and `os_version` from the lookup
   - Optional rename input (defaults to "My WaveX OS")
   - Big "Pair this device" button
   - Small "This isn't me" link → does nothing destructive, just doesn't
     submit

5. **On submit, call the edge function `os-claim-device`.** Contract is
   FROZEN — do not change it:

   ```
   POST {SUPABASE_URL}/functions/v1/os-claim-device
   Authorization: Bearer <user's supabase auth JWT from supabase.auth.getSession().access_token>
   Content-Type: application/json
   apikey: <anon key>

   Body:
   {
     "user_code": "UVEZ-97XY",
     "device_name": "Roberto's MacBook"        // optional
   }

   Success response:
   { "ok": true, "device_id": "<uuid>", "device_name": "<string>" }

   Pending / error responses (all HTTP 200, discriminate on `ok`):
   { "ok": false, "error": "unauthorized" }            // not signed in
   { "ok": false, "error": "missing_user_code" }
   { "ok": false, "error": "invalid_or_expired_code" }
   { "ok": false, "error": "device_create_failed" }
   { "ok": false, "error": "<other>" }                  // surface message
   ```

6. **On success.** Show "Device paired. You can close this tab — your
   terminal will finish setup." The CLI is polling `os-device-token` every
   2s; it picks up the claim within seconds and writes the device token to
   disk on the customer's machine.

7. **On error.** Show the specific error in a way the customer can act on
   (especially `invalid_or_expired_code` — give them the "run `wavex-os
   login` again" path back to their terminal).

### What `/os/pricing` must do (the tier-select page)

It probably already exists from your earlier work, but verify it ships these
three pieces end-to-end:

1. **Three tier cards.** Pull tier metadata from `wavex_os.subscriptions`
   plan constraint — the allowed tiers are exactly `founder`, `growth`,
   `custom`. Headline price + bullet points. The middle tier (`growth`) is
   featured. Tier-to-display-price comes from your existing Stripe price
   wiring; do not hardcode dollar amounts in the React component if you can
   read them from the price object.

2. **Supabase auth widget inline.** If the visitor is signed-in, skip the
   widget; if not, gate the "Subscribe" CTA behind it. The page must work
   without a separate `/os/login` round-trip.

3. **Subscribe CTA → Stripe Checkout.** Call the existing
   `create-checkout-session` edge function (FROZEN). Its contract:

   ```
   POST {SUPABASE_URL}/functions/v1/create-checkout-session
   Authorization: Bearer <user's auth JWT>
   apikey: <anon key>

   Body:
   {
     "tier": "founder" | "growth" | "custom",
     "success_url": "https://wavexcard.com/os/checkout-success?session_id={CHECKOUT_SESSION_ID}",
     "cancel_url":  "https://wavexcard.com/os/pricing"
   }

   Response:
   { "ok": true, "url": "https://checkout.stripe.com/c/pay/cs_..." }
   ```

   On `ok: true`, `window.location.href = url` to redirect to Stripe.

### What `/os/checkout-success` must do (the post-payment page)

This is the **missing UX** the audit flagged. Right now nothing intentionally
greets a freshly-paid customer; they're dropped back to `/os` or `/os/pricing`
with `?success=1` and have no idea what to do next.

1. **Read `session_id` from the URL.** Poll `wavex_os.subscriptions` via the
   already-existing `wavex_os_subscription_by_checkout` RPC to confirm the
   Stripe webhook landed. RPC contract:

   ```
   supabase.rpc('wavex_os_subscription_by_checkout', { _session_id: '<session_id>' })
   →  [{ id, tier, status, current_period_end, trial_end, ... }]  // 1 row
   ```

   The Stripe webhook is async (Stripe → `wavex-os-subscription-webhook`
   edge fn → upsert into `wavex_os.subscriptions`) so poll for ≤60s with a
   2s interval. On timeout, show "Your payment succeeded — your subscription
   will activate within a minute. Refresh, or check email for confirmation."

2. **Show "you're in" + the install instructions.** Once the subscription
   row appears, render the install snippet — this is the path forward the
   customer cannot guess on their own:

   ```
   You're subscribed to <Tier>. Trial ends <date>.

   On your computer (Mac / Linux / Windows), open a terminal and run:

   $ git clone https://github.com/aimerdoux/wavex-os.git
   $ cd wavex-os
   $ pnpm install
   $ pnpm wavex:os login

   The CLI will print a pair code and open this site. Click "Pair this
   device" when it appears and you're done.
   ```

   Make those code blocks click-to-copy. Include a brief "what to install
   first" note: Node 22+, pnpm 8+, git. Link to a one-paragraph
   troubleshooting drawer ("if `pnpm` is missing: `npm install -g pnpm`").

3. **Provide a "go to console" link.** It only becomes active once the
   customer has paired at least one device — otherwise the console is empty
   and confusing. Read `wavex_os.os_devices` count for the user; if zero,
   the link is greyed with "pair a device first."

### What `/os` (entry) must do

You already built this. Verify it does the right thing for two paths:

- **Unauthenticated:** marketing copy + "Get Started" CTA → `/os/pricing`.
- **Authenticated with active subscription:** "Continue setup" CTA →
  `/os/console` if they have at least one device paired, else
  `/os/checkout-success` (the install-instructions surface). Don't dump
  authenticated paying customers back on the marketing page.

### Auth + Supabase setup you already have

Use the existing `supabase` client from your project's lib. The anon key and
URL are already configured. **Never use the service-role key in the
browser** — every call from `/os/link`, `/os/pricing`, `/os/checkout-success`
goes through edge functions (with the user's auth JWT) or RPCs (gated by
RLS).

### Frozen contracts — do not change these

- Edge function names + URLs: `os-link-device`, `os-claim-device`,
  `os-device-token`, `os-device-refresh`, `create-checkout-session`,
  `wavex-os-subscription-webhook`. All at
  `{SUPABASE_URL}/functions/v1/<name>`. They are deployed and working.
- RPC names: `os_lookup_pairing(_user_code text)`,
  `wavex_os_subscription_by_checkout(_session_id text)`. Use as-is.
- The `user_code` format `XXXX-YYYY` (8 chars + 1 hyphen). The hyphen is
  significant — keep it when calling edge functions.
- The `wavex_os.subscriptions.tier` enum is exactly `founder | growth |
  custom`. Do not invent additional tiers.
- The customer install command is `pnpm wavex:os login`. Not `wavex-os
  login`, not `npx wavex-os login`. The customer must be inside the wavex-os
  repo for the command to resolve. The install snippet on
  `/os/checkout-success` is the canonical version.

### Definition of done

1. `https://wavexcard.com/os/link?code=ABCD-EFGH` renders without crashing,
   for both signed-out and signed-in visitors. The UiConfigContext error
   must be gone.
2. Signed-in user with a valid `code` sees a device-confirm card with
   hostname + OS, can click "Pair this device", and on success sees "you can
   close this tab."
3. Real round-trip works: I run `pnpm wavex:os login` on a fresh laptop, get
   a pair code, visit `/os/link?code=<that code>`, claim it, and within
   ~5 seconds the CLI on the laptop reports success and writes
   `~/.wavex-os/device-token.json`. (You can test this — ask me for a fresh
   code.)
4. `/os/pricing` renders the 3 tiers, supports sign-in inline, and clicking
   Subscribe redirects to Stripe Checkout for the right tier.
5. After paying in Stripe test mode, the customer lands on
   `/os/checkout-success`, sees the install snippet, and the page polls
   until the subscription row materializes.
6. Empty states: a customer who reaches `/os/checkout-success` with no
   `session_id` (e.g. opened the URL directly) sees "we couldn't find your
   checkout session" — not a crash and not a blank page.
7. No mock data anywhere in shipped components. No `console.log` debug
   noise.

### What's out of scope

- Anything inside `/os/console` or `/os/admin` (already shipped — your
  earlier prompt).
- The backend edge functions and RPCs — they live in the wavex-os Supabase
  project, not in your code.
- The CLI on the customer's machine — that's in the wavex-os repo and is
  already polling for `os-claim-device` to succeed.
- Stripe webhook handling — `wavex-os-subscription-webhook` is already
  deployed.

### What I (the operator) will do separately

- Register the Stripe webhook URL in Stripe Dashboard if I haven't yet.
- Provide live Stripe price IDs for prod cutover (you keep using the test
  prices that are already in `.env`).
- Verify the round-trip with a real Windows customer once `/os/link` stops
  crashing.

Ping me with a deploy preview URL when `/os/link` no longer crashes — I'll
run the full pair flow against the live edge functions to confirm.
