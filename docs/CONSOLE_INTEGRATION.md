# Console ↔ Local Integration — Wire Contract

How the WaveX OS Console (`wavexcard.com/os`, hosted on Supabase project
`ngvtgraldybxdbgkihfj`) and a local wavex-os install talk to each other.

Both sides need to agree on a small set of HTTP contracts + a shared HS256
secret. This doc is the authoritative description of those contracts.

## Components

| Side | What it owns |
|---|---|
| **Cloud** (Lovable project `wavex-experience-architect`) | Pricing page, Alchemy auth, `os-link-device` / `os-claim-device` / `os-device-token` / `os-device-refresh` / `os-inference` / `os-spend-intent` edge functions, Stripe webhook, agent_wallets, Bridge cards, `os_devices` / `os_device_pairings` / `os_device_policies` / `os_usage` tables |
| **Local** (this repo, `wavex-os`) | Onboarding wizard, Liaison + fleet agents, Paperclip runtime, `@wavex-os/auth-shim/verifyDeviceJwt`, `@wavex-os/cloud-client` (this turn), inference-server (Pool A operator's Max OAuth path) |

## Shared secret

`WAVEX_DEVICE_JWT_SECRET` — HS256 key both sides use to sign + verify device JWTs.

Storage:
- **Cloud**: Supabase function secret. Set with
  `supabase secrets set WAVEX_DEVICE_JWT_SECRET=<value> --project-ref ngvtgraldybxdbgkihfj`,
  then redeploy the 4 device edge functions.
- **Local**: `~/.wavex-os/state/.env` (chmod 600, outside the git repo).

Requirements:
- ≥ 32 bytes of cryptographic randomness (`openssl rand -hex 32` produces a
  good value).
- Both sides must rotate simultaneously. Out-of-sync = all device JWTs fail
  signature verification on whichever side has the old key.

## Device pairing flow

```
local CLI                            cloud edge fns                 user browser
─────────                            ──────────────                 ────────────
$ wavex-os login                     —                              —
    │
    │  POST /os-link-device           →
    │                                       creates pairing row
    │                                       returns user_code +
    │                                       device_code + interval
    │  ←───────────────────────────
    │
    │  open browser to
    │  /os/link?code=USER-CODE          ─────────────────────────→
    │                                                                user confirms
    │                                                                code matches +
    │                                                                clicks "Pair"
    │                                                                     │
    │                                                                     ↓
    │                                   POST /os-claim-device  ←─────
    │                                       binds pairing.user_id
    │
    │  POST /os-device-token            (every interval seconds)
    │      { device_code }
    │                                       lookup pairing
    │                                       if claimed → mint JWT
    │                                       atomically mark consumed
    │  ←─── { access_token,
    │        refresh_token,
    │        access_token_expires_at,
    │        user_id, device_id }
    │
    │  writeBundle()                   →
    │      ~/.wavex-os/device-token.json (chmod 600)
    ▼
```

After this, every cloud call from the local side adds
`Authorization: Bearer <access_token>`.

Token rotation: `access_token` has a 1 h TTL. The cloud-client refreshes
it automatically when it expires in < 60 s, via:

```
POST /os-device-refresh { refresh_token }
  → { access_token, refresh_token, access_token_expires_at, … }
```

Single-flight per process — concurrent callers all await the same Promise.

## Endpoint contracts (cloud functions)

All endpoints under `https://ngvtgraldybxdbgkihfj.supabase.co/functions/v1/`.
Override with `WAVEX_CLOUD_FUNCTIONS_URL` env var.

### `os-link-device` — POST, no auth

```jsonc
// request: empty body (or { device_meta?: {...} })
// response 200:
{
  "user_code": "ABCD-1234",
  "device_code": "<opaque-uuid>",
  "expires_in": 600,
  "interval": 2,
  "verification_url": "https://wavexcard.com/os/link?code=ABCD-1234"
}
```

### `os-claim-device` — POST, requires user-session auth (browser-side)

```jsonc
// request: { user_code }
// response 200: { ok: true, user_id, device_id }
// response 4xx: { error: "code_expired" | "code_invalid" | "already_claimed" }
```

### `os-device-token` — POST, no auth (polled by CLI with device_code)

```jsonc
// request: { device_code }

// response 202 (or { status: "pending" }): user hasn't claimed yet — poll again
// response 200:
{
  "access_token": "<HS256 JWT>",
  "refresh_token": "<opaque, hashed server-side>",
  "access_token_expires_at": 1714200000,
  "user_id": "<uuid>",
  "device_id": "<uuid>"
}
// response 4xx: { error: "code_expired" | "consumed" }
```

JWT claim shape:
```jsonc
{ "aud": "os-device", "sub": "<user_id>", "device_id": "<uuid>",
  "scope": "os_device", "iat": 1714196400, "exp": 1714200000 }
```

### `os-device-refresh` — POST, no auth (rotates via refresh token)

```jsonc
// request:  { refresh_token }
// response: same shape as os-device-token success
// 4xx:      { error: "invalid_refresh" | "revoked" }
```

### `os-inference` — POST, requires device JWT

```jsonc
// request:
{ "prompt": "...", "model"?: "claude-sonnet-4-5", "max_output_tokens"?: 4096,
  "purpose"?: "onboarding-pillar-1" }

// response 200:
{ "ok": true, "content": "...", "model": "claude-sonnet-4-5",
  "request_id": "msg_...", "usage": { "input_tokens": 421, "output_tokens": 873, ... },
  "quota": { "tokens_used_this_period": 142_193, "tokens_remaining_this_period": 1_857_807,
             "period_resets_at": 1717862400 } }

// response 200 (business error — never throws to client):
{ "ok": false, "error": "quota_exceeded" | "tier_not_eligible" | "subscription_expired"
              | "rate_limited" | "upstream_error" | "internal",
  "message": "...", "upgrade_url"?: "...", "retry_after"?: 60 }
```

### `os-spend-intent` — POST, requires device JWT + idempotency key

Local agents NEVER call this directly. The Liaison observes
`spend_request`-labeled Paperclip issues, validates, then proxies.

```jsonc
// headers: Authorization: Bearer <jwt>, Idempotency-Key: <uuid>
// request:
{ "kind": "subscription" | "issue_card" | "send_bank" | "topup_wallet",
  "amount_cents": 5000, "recipient": "Notion (sub_xyz)",
  "reason": "Renew team workspace — Pillar 4 cadence", "source_issue_id"?: "issue-abc",
  "idempotency_key": "<uuid>" }

// response 200 — approved + executed (below cap, whitelisted):
{ "ok": true, "status": "executed", "intent_id": "spend_…",
  "receipt": { "rail": "bridge_card" | "stripe" | "bridge_ach" | "wallet_topup",
               "external_id": "…", "executed_at": 1714196400 } }

// response 200 — needs manual approval (above cap, unknown recipient, …):
{ "ok": true, "status": "pending_approval", "intent_id": "spend_…",
  "approval_url": "https://wavexcard.com/os/console#approvals/spend_…",
  "reason_code": "above_cap" | "unknown_recipient" | "policy_match" }

// response 200 — declined:
{ "ok": false, "error": "tier_not_eligible" | "insufficient_balance"
              | "policy_denied" | "kind_not_permitted" | "asset_not_allowed"
              | "subscription_expired" | "rate_limited" | "upstream_error" | "internal",
  "message": "…", "upgrade_url"?: "…" }
```

## Local-side packages

| Package | What it provides |
|---|---|
| `@wavex-os/auth-shim` | `verifyDeviceJwt(token)` — HS256 verify + claim-shape check. Pure node:crypto, no JWT lib. |
| `@wavex-os/cloud-client` | `runLogin()`, `cloudInference()`, `submitSpendIntent()`, token store with auto-refresh. |

### Importing

```ts
import { verifyDeviceJwt } from "@wavex-os/auth-shim";
import {
  cloudInference,
  submitSpendIntent,
  getValidAccessToken,
  introspectBundle,
} from "@wavex-os/cloud-client";

// Read-only health check from a launchd job:
const introspect = await introspectBundle();
if (!introspect.ok) console.log("paired:", introspect.reason);

// Call inference (paid tier):
const r = await cloudInference({ prompt: "…", purpose: "onboarding-pillar-1" });
if (!r.ok && r.error === "no_paired_device") {
  console.log("run `wavex-os login` first");
}
```

## Tier routing

The inference path picks based on tier + pairing state:

```
free tier  OR no device paired  →  local Pool A (operator's Claude Max OAuth via
                                    inference-server :8787 with
                                    WAVEX_INFERENCE_BACKEND=oauth)
founder / growth / custom       →  cloudInference() → os-inference → Lovable AI
                                    Gateway → Anthropic. Billed to cloud operator's
                                    gateway key, accounted against user's tier quota.
```

The tier-router code that implements this branching is a follow-up to this
turn — packages/cloud-client provides the call surface; the router decides
when to invoke it.

## Spend authority

Single entry point through the Liaison keeps the audit trail clean:

```
fleet agent files Paperclip issue with label "spend_request"
   │
   ▼
Liaison heartbeat picks it up, parses the request body, validates against:
   - local manifest (does this agent's role permit this kind?)
   - device policy (cached from os_device_policies)
   - asset rule (USDC/USDT only, per memory constraint)
   │
   ▼
submitSpendIntent({ kind, amount_cents, recipient, reason, source_issue_id, idempotency_key })
   │
   ▼
cloud-side checks (re-validates everything + the wallet balance + tier eligibility)
   │
   ├── below cap + whitelisted → execute → reply { status: "executed", receipt }
   │       Liaison posts receipt as a comment on the source issue, closes it.
   │
   └── above cap / unknown recipient → reply { status: "pending_approval", approval_url }
           Liaison posts approval link as a comment, leaves issue open.
           User clicks link → completes TOTP in console → cloud executes → webhook back to
           Liaison → Liaison appends receipt, closes issue.
```

No fleet agent ever holds a device JWT. The Liaison is the only local actor
authorized to call `submitSpendIntent`.

## Operator runbook

### First-time pairing
```
$ pnpm wavex:login
# OR: node scripts/wavex-login.mjs
```
Browser opens to `wavexcard.com/os/link?code=…`. Confirm code, click Pair.
Bundle written to `~/.wavex-os/device-token.json`. CLI prints user_id +
device_id once paired.

### Re-pair after revoke
The console can revoke a device. Next cloud call will return
`{ error: "no_paired_device" }` or 401. Re-run `wavex:login` to fix.

### Smoke the local side
```
$ pnpm wavex:cloud-client:smoke   # offline tests, 14 assertions
$ node node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/cli.mjs \
      packages/auth-shim/scripts/smoke-device-jwt.mjs   # validator round-trip, 16 assertions
```

### Rotate the shared secret
1. Generate: `openssl rand -hex 32`
2. Cloud: `supabase secrets set WAVEX_DEVICE_JWT_SECRET=<value> --project-ref ngvtgraldybxdbgkihfj`
3. Redeploy: `supabase functions deploy os-link-device os-claim-device os-device-token os-device-refresh --project-ref ngvtgraldybxdbgkihfj`
4. Local: edit `~/.wavex-os/state/.env`, replace `WAVEX_DEVICE_JWT_SECRET`
5. Smoke both sides
6. Existing devices need to re-pair (their JWTs were signed with the old key)
