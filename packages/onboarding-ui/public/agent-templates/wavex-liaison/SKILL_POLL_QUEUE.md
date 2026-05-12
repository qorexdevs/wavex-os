# Liaison — polling the optimizer queue

After uploading the digest (or skipping when it's empty), poll the WaveX inference server for any injections the per-catalog workers have queued for THIS customer.

## The endpoint

```
GET ${WAVEX_INFERENCE_URL}/v1/optimizer/queue/${SUBSCRIPTION_ID}
   Authorization: Bearer ${SUBSCRIPTION_JWT}
   Body: { "last_seen_injection_id": "<uuid or empty>" }
```

`WAVEX_INFERENCE_URL` defaults to `https://api.wavex-os.com`. Override via env for testing against a local inference-server at `http://127.0.0.1:8787`.

## The JWT

`SUBSCRIPTION_JWT` lives in `~/.wavex-os/subscription.json`. It was minted by the stripe-webhook function at hire-time. If the file is missing or the JWT is expired, refresh:

```bash
curl -sf -X POST -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
     -H "apikey: ${SUPABASE_ANON_KEY}" \
     -H "Content-Type: application/json" \
     "${SUPABASE_URL}/functions/v1/refresh-subscription-jwt" \
  | jq -r '.jwt' > /tmp/jwt.txt

SUBSCRIPTION_JWT="$(cat /tmp/jwt.txt)"
jq -n --arg jwt "$SUBSCRIPTION_JWT" '. + {jwt: $jwt}' < ~/.wavex-os/subscription.json > ~/.wavex-os/subscription.json.tmp \
  && mv ~/.wavex-os/subscription.json.tmp ~/.wavex-os/subscription.json
rm /tmp/jwt.txt
```

`refresh-subscription-jwt` lands in F.5 alongside the worker functions. Until then, the original JWT issued at hire-time is good for 90 days.

## Polling

```bash
LAST_SEEN=$(cat ~/.wavex-os/state/liaison-last-seen-injection 2>/dev/null || echo "")
RESPONSE=$(curl -sf -X POST \
  -H "Authorization: Bearer ${SUBSCRIPTION_JWT}" \
  -H "Content-Type: application/json" \
  -d "{\"last_seen_injection_id\": \"${LAST_SEEN}\"}" \
  "${WAVEX_INFERENCE_URL}/v1/optimizer/queue/${SUBSCRIPTION_ID}" \
  -w "\n__HTTP_STATUS__:%{http_code}")

STATUS=$(echo "$RESPONSE" | tail -1 | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '$d')
```

## Handling each status

| Status | Meaning | Action |
|---|---|---|
| 200 | Queue returned, possibly empty | Parse `.injections`, proceed to verify+deliver |
| 401 | JWT invalid/expired | Refresh JWT (see above). Retry once. If still 401, idle. |
| 402 | Subscription not active | Server sees the customer as lapsed. Idle quietly. Mission Control will surface the lapse separately. NEVER page operator from here. |
| 429 | Rate limit | Back off: skip next heartbeat, double the back-off window each subsequent failure up to 30min. Reset on first success. |
| 503 | Server is frozen (admin kill switch) OR not yet wired (G.3 stubs) | Idle. Try again next heartbeat. |
| anything else | Unknown — file `[BLOCKED]` issue with response body + STATUS | Operator escalation |

## What's in a 200 response

```jsonc
{
  "injections": [
    {
      "id": "<uuid>",
      "kind": "issue_comment" | "new_issue" | "workflow_proposal" |
              "spawn_throttle_call" | "human_escalation",
      "payload": { ... },
      "issued_by_catalog_id": "optimizer-v1",
      "issued_at": "2026-05-12T19:00:00Z",
      "signature_b64": "<Ed25519 sig>"
    }
  ],
  "next_poll_at": "2026-05-12T19:05:00Z"
}
```

`next_poll_at` is advisory. The Liaison's hardcoded 5min heartbeat is the source of truth.

## What you do NOT do at this step

- DO NOT post any payload to Paperclip yet. Verification is a separate step. See `SKILL_DELIVER_INJECTION.md`.
- DO NOT trust the `issued_by_catalog_id` field on its own. The signature is what verifies the issuer; the field is just a hint for picking which public key to verify against.
- DO NOT mark the injection consumed in the queue until after successful delivery.
