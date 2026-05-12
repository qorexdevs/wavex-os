# Liaison — encrypting and uploading the digest

After `SKILL_BUILD_DIGEST` produced `/tmp/wavex-digest-$$.json`, you call `tools/encrypt-envelopes.mjs` to seal it for the hired Expert Agents.

## The contract enforced by encrypt-envelopes.mjs

For every field in the digest:

1. Look up which active hired_expert_agents (this subscription_id) have this field in their catalog's `data_scope`.
2. For each such hire, build a libsodium **sealed-box** envelope using that catalog's `recipient_public_key`.
3. Output `{ <field>: { recipients: [{ catalog_id, ciphertext_b64 }], field_hash: <sha256 of plaintext> } }`.

Fields with **zero recipients** are dropped entirely. The plaintext for those fields never leaves the customer's Mac — it never even reaches the upload payload.

## Run it

```bash
SUPABASE_URL="${SUPABASE_URL}" \
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY}" \
SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN}" \
SUBSCRIPTION_ID="${SUBSCRIPTION_ID}" \
  node "${TOOLS_DIR}/encrypt-envelopes.mjs" \
    < /tmp/wavex-digest-$$.json \
    > /tmp/wavex-envelopes-$$.json
```

The tool:
- Reads the customer's `hired_expert_agents` table via Supabase JS (RLS-scoped — only sees this customer's rows)
- For each active hire, joins to `expert_agent_catalog` to get `data_scope` + `recipient_public_key`
- Builds the envelopes
- Writes the result to stdout

## Upload

```bash
curl -sf -X POST \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "$(jq -n \
        --arg sub "$SUBSCRIPTION_ID" \
        --slurpfile env /tmp/wavex-envelopes-$$.json \
        '{
          subscription_id: $sub,
          digest: {},
          digest_hash: "field-envelopes-v1",
          field_envelopes: $env[0],
          redaction_policy: "full"
        }')" \
  "${SUPABASE_URL}/rest/v1/wavex_os/fleet_digests"
```

The `digest_hash: "field-envelopes-v1"` sentinel signals to the server-side workers that this row uses the F.4 field-envelope format rather than the legacy plain-digest format.

## Verification (per SKILL_VERIFY_BEFORE_CLAIM)

After the curl returns, you cannot claim "uploaded" until you've verified the row landed:

```bash
curl -sf -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
     -H "apikey: ${SUPABASE_ANON_KEY}" \
     "${SUPABASE_URL}/rest/v1/wavex_os/fleet_digests?subscription_id=eq.${SUBSCRIPTION_ID}&order=received_at.desc&limit=1" \
  | jq '.[0] | {id, received_at, field_count: (.field_envelopes | length)}'
```

Quote that JSON in your cycle comment. That's your verification probe.

## Cleanup

Always shred the temp files before exiting:

```bash
shred -u /tmp/wavex-digest-$$.json /tmp/wavex-envelopes-$$.json 2>/dev/null \
  || rm -f /tmp/wavex-digest-$$.json /tmp/wavex-envelopes-$$.json
```

These files hold plaintext for the duration of one heartbeat. Leaving them around defeats the entire encryption point.

## Public-key rotation handling

`encrypt-envelopes.mjs` always uses whatever `recipient_public_key` is currently in the catalog row. If WaveX rotates a key, the next heartbeat picks up the new key automatically — no Liaison restart required. Pre-rotation in-flight digests addressed to the old public key may be unreadable by the new worker, but they will TTL out after 24h. This is by design.

## Error handling

- `encrypt-envelopes.mjs` exits non-zero → STOP, file BLOCKED issue, retry next heartbeat
- curl returns non-2xx → STOP, file BLOCKED issue with the response body
- Supabase returns 401 → the customer's access token expired; refresh via the auth lib (or fall back to idle until next heartbeat)
- Supabase returns 403 → an RLS policy denied the write. Probably means the customer's subscription is canceled. Don't retry; idle.
