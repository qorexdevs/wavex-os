# refresh-subscription-jwt (F.4.f / F.5)

Liaison JWT rotation endpoint. Pool C clients (the customer's local
wavex-liaison agent) call this every 24h to swap their current JWT for a
fresh one bound to the same subscription. The first JWT is bootstrapped
without a Bearer header by passing `{ bootstrap: true, subscription_id }`.

## Deploy

```bash
supabase login
supabase functions deploy refresh-subscription-jwt --no-verify-jwt
```

`--no-verify-jwt` is required: the JWT the function verifies is the
WaveX-internal HS256 token, which is the wrong audience for Supabase's own
JWT layer.

## Required secrets

```bash
# 32+ random bytes, base64 encoded
openssl rand -base64 48 | tr -d '\n' \
  | xargs -I {} supabase secrets set WAVEX_LIAISON_JWT_SECRET={}
```

Auto-injected by Supabase: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

## Request

```http
POST /functions/v1/refresh-subscription-jwt
Authorization: Bearer <current jwt>            # for normal refresh
Content-Type: application/json
```

Or, on first-time bootstrap (no JWT yet):

```http
POST /functions/v1/refresh-subscription-jwt
Content-Type: application/json

{ "bootstrap": true, "subscription_id": "<uuid>" }
```

## Response (200)

```jsonc
{
  "jwt": "eyJhbGc...",
  "expires_at": "2026-05-14T00:00:00Z",
  "tier": "growth",
  "subscription_id": "uuid",
  "rotated_from_jti": "<prior token's jti>"  // null on bootstrap
}
```

## Refusal modes

- 401 `invalid_token` — current JWT signature failed verification
- 401 `token_too_old` — JWT > 7d old; client must re-bootstrap
- 403 `subscription_not_active` — DB lookup says subscription is canceled/past_due/etc
- 401 `missing_credentials` — no Bearer header AND no bootstrap body

## Initial JWT issuance

The first JWT is issued at hire-time (stripe-webhook handler — F.5.b). Until
that path lands, the customer's local `subscription.json` will hold `jwt: ""`
and they should call this function with the bootstrap body to receive their
first token. Document under docs/PHASE_F_SETUP.md as part of the customer
onboarding flow.

## Cost

Edge function invocation is included in Supabase's free tier up to
500K invocations/month. With 24h rotation per customer, 1,000 customers =
30K invocations/month — well within free tier.
