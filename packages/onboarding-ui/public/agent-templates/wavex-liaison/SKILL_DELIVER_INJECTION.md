# Liaison — verifying and delivering injections

For each injection returned by the optimizer queue, run **two checks** before posting anything to local Paperclip:

1. The signature is valid (`verify-injection.mjs`).
2. The catalog id pins to the public key we have on record for it (also `verify-injection.mjs`).

If both pass, the payload is delivered. If either fails, the injection is REJECTED and logged.

## The verify call

```bash
# Fetch the catalog's current signing public key (from Supabase, not the
# injection itself — never trust self-attested keys)
CATALOG_KEY=$(curl -sf \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  "${SUPABASE_URL}/rest/v1/wavex_os/expert_agent_catalog?id=eq.${INJECTION_CATALOG_ID}&select=signing_public_key" \
  | jq -r '.[0].signing_public_key')

# Pass to the verifier — it checks signature, refuses on pin mismatch
PAYLOAD=$(echo "${INJECTION_JSON}" | \
  WAVEX_LIAISON_EXPECTED_KEY_B64="${CATALOG_KEY}" \
  node "${TOOLS_DIR}/verify-injection.mjs")
VERIFY_STATUS=$?
```

If `VERIFY_STATUS` is non-zero:

```bash
# REJECTED: file a high-priority issue with the reason from stderr
curl -sf -X POST "http://127.0.0.1:3100/api/companies/${COMPANY_ID}/issues" \
     -H "Content-Type: application/json" \
     -d "$(jq -n --arg id "${INJECTION_ID}" --arg cid "${INJECTION_CATALOG_ID}" \
              '{title: "[REJECTED-INJECTION] " + $cid + " " + $id,
                description: "Rejected by Liaison verify-injection.mjs. See agent log.",
                priority: "high",
                tags: ["wavex:rejected-injection"]}')"
# Do NOT post the payload. Do NOT mark consumed. Continue to next injection.
```

If `VERIFY_STATUS` is zero, deliver per `payload.kind`:

## Delivery by kind

### `issue_comment`

```bash
echo "$PAYLOAD" | jq -r '"\(.payload.issue_key) \(.payload.body)"' | \
while IFS=' ' read -r ISSUE_KEY REST; do
  COMMENT_RESPONSE=$(curl -sf -X POST \
    "http://127.0.0.1:3100/api/issues/${ISSUE_KEY}/comments" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg body "$REST" '{body: $body, author_kind: "wavex_expert_agent"}')")
  echo "$COMMENT_RESPONSE" | jq '.id'   # verification: comment uuid
done
```

### `new_issue`

```bash
ISSUE_RESPONSE=$(curl -sf -X POST \
  "http://127.0.0.1:3100/api/companies/${COMPANY_ID}/issues" \
  -H "Content-Type: application/json" \
  -d "$(echo "$PAYLOAD" | jq '.payload + {tags: ((.payload.tags // []) + ["wavex:expert-issued"]), source_catalog: .issued_by_catalog_id}')")
NEW_KEY=$(echo "$ISSUE_RESPONSE" | jq -r '.key')
```

The `wavex:expert-issued` tag lets CEO/CoS distinguish operator-filed issues from Expert-Agent-filed issues. They're treated identically in the grading rubric but the tag is searchable.

### `workflow_proposal`

```bash
# Posts as an issue-thread interaction so the assignee_agent sees it on
# next wake. Customer's CEO grades it like any other suggest_tasks.
curl -sf -X POST \
  "http://127.0.0.1:3100/api/issues/${PAYLOAD_ISSUE_KEY}/interactions" \
  -H "Content-Type: application/json" \
  -d "$(echo "$PAYLOAD" | jq '{kind: "suggest_tasks", suggestion: .payload, source_catalog: .issued_by_catalog_id}')"
```

### `spawn_throttle_call`

Only the **Error Handler** and **Concierge** Expert Agents are allowed to call this — the catalog enforces this via `output_types`. If you receive a `spawn_throttle_call` from any other catalog, REJECT it.

```bash
curl -sf -X POST "http://127.0.0.1:3100/api/maintenance/spawn-throttle" \
     -H "Content-Type: application/json" \
     -d "$(echo "$PAYLOAD" | jq '.payload + {reason: "wavex:" + .issued_by_catalog_id}')"
```

### `human_escalation`

Concierge only. Posts to the operator's Telegram via the existing Pillar 5 bridge.

```bash
curl -sf -X POST "http://127.0.0.1:3100/api/pillar5/send-board-message" \
     -H "Content-Type: application/json" \
     -d "$(echo "$PAYLOAD" | jq '{message: .payload.message, severity: .payload.severity, source_catalog: .issued_by_catalog_id}')"
```

## Marking consumed

After successful delivery (you have a 2xx response with the Paperclip comment/issue id):

```bash
echo "$INJECTION_ID" > ~/.wavex-os/state/liaison-last-seen-injection
curl -sf -X PATCH \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"consumed_at\":\"$(date -u +%FT%TZ)\",\"consumed_by_liaison_id\":\"${LIAISON_AGENT_ID}\"}" \
  "${SUPABASE_URL}/rest/v1/wavex_os/injection_queue?id=eq.${INJECTION_ID}"
```

If the PATCH fails, the injection will be re-served on next poll. Idempotency on the Paperclip side is via the `id` field — repeated `kind=new_issue` payloads with the same source_catalog + payload hash will be detected and de-duplicated by Paperclip's CoS grader on next sweep.

## Verification probe (per SKILL_VERIFY_BEFORE_CLAIM)

In your cycle report, quote the actual Paperclip ids you wrote:

```
LIAISON CYCLE — 2026-05-12T19:00:05Z
hires_active: 2
fields_uploaded: kpi_snapshots, open_issue_titles, fleet_status, failed_runs, error_signatures
injections_received: 2
injections_delivered: 2
  • optimizer-v1 → issue WAV-123 comment a78f2c01-...
  • error-handler-v1 → new issue WAV-145 (priority: high)
injections_rejected: 0
NEXT_HEARTBEAT_AT: 2026-05-12T19:05:00Z
```

That's the verification trail. The `WAV-123` keys + `a78f2c01-...` uuid are what `delivery-truth.mjs` checks for.

## What you do NOT do

- DO NOT post the injection's `payload.body` verbatim without source attribution. Every Paperclip comment/issue you write must include `source_catalog: <catalog_id>` so the CoS grader can tell which Expert Agent recommended this.
- DO NOT escalate to operator without explicit `human_escalation` kind from Concierge. The Liaison is not allowed to invent escalations.
- DO NOT retry rejected injections. Once `verify-injection.mjs` fails, that injection is permanently dead. The server-side worker is expected to re-issue on next cycle if the underlying recommendation still applies.
