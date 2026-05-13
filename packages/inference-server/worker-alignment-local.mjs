/**
 * F.5 worker — alignment-v1, running locally on the Mac mini using
 * Claude Max OAuth instead of an API key.
 *
 * Catalog charter: watches KPI deltas vs the Monte Carlo target curve and
 * files course-correction directives when drift exceeds threshold. Active
 * only when subscribed at Growth+.
 *
 * Stdin: JSON `{ envelopes, hire_id, digest_id, subscription_id }`
 * Stdout: JSON `{ status, injection?, usage, audit }`
 * Stderr: human-readable progress (no secret values)
 */
import sodium from "libsodium-wrappers";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const CATALOG_ID = "alignment-v1";
const MODEL = "claude-sonnet-4-5";

await sodium.ready;

function getOAuthToken() {
  const raw = execSync(`security find-generic-password -s 'Claude Code-credentials' -w 2>/dev/null`, { encoding: "utf8" }).trim();
  const env = JSON.parse(raw);
  const expiresAt = env.claudeAiOauth.expiresAt;
  if (expiresAt && expiresAt < Date.now() + 60_000) {
    console.error(`  ! OAuth token expires in <60s; refresh needed (not implemented in this harness)`);
  }
  return env.claudeAiOauth.accessToken;
}

function loadKeys(catalogId) {
  const enc = execSync(`security find-generic-password -s 'wavex-os.expert-agent.${catalogId}' -w 2>/dev/null`, { encoding: "utf8" }).trim();
  const sign = execSync(`security find-generic-password -s 'wavex-os.expert-agent-sign.${catalogId}' -w 2>/dev/null`, { encoding: "utf8" }).trim();
  const encPriv = sodium.from_base64(enc, sodium.base64_variants.ORIGINAL);
  const signPriv = sodium.from_base64(sign, sodium.base64_variants.ORIGINAL);
  const encPub = sodium.crypto_scalarmult_base(encPriv);
  return { encPriv, signPriv, encPub };
}

const input = JSON.parse(readFileSync(0, "utf8"));
const { envelopes, hire_id, digest_id, subscription_id } = input;
if (!envelopes || !hire_id || !digest_id || !subscription_id) {
  console.error("Required stdin: { envelopes, hire_id, digest_id, subscription_id }");
  process.exit(1);
}

console.error("=== F.5 worker run — " + CATALOG_ID + " ===");
console.error("  subscription:", subscription_id);
console.error("  digest:", digest_id);

const { encPriv, signPriv, encPub } = loadKeys(CATALOG_ID);
console.error("  ✓ loaded keypair from Keychain");

const decoded = {};
for (const [field, env] of Object.entries(envelopes)) {
  const me = env.recipients?.find((r) => r.catalog_id === CATALOG_ID);
  if (!me) continue;
  const cipher = sodium.from_base64(me.ciphertext_b64, sodium.base64_variants.ORIGINAL);
  try {
    const plain = sodium.crypto_box_seal_open(cipher, encPub, encPriv);
    decoded[field] = JSON.parse(new TextDecoder().decode(plain));
  } catch (e) {
    console.error(`  ✗ decrypt failed for ${field}: ${e.message}`);
  }
}
const fieldsAccessed = Object.keys(decoded);
console.error("  ✓ decrypted fields:", fieldsAccessed.join(", "));

if (fieldsAccessed.length === 0) {
  process.stdout.write(JSON.stringify({ status: "skipped", reason: "no fields in scope" }));
  process.exit(0);
}

// docs/prompts/alignment-correction.md (inline canonical version)
const promptText = [
  "You are the WaveX Alignment agent. Your job: compare the customer's",
  "current KPI snapshots and deltas against the Monte Carlo target curve",
  "for their meta-goal. If drift exceeds threshold (a KPI is materially",
  "off-curve for >24h), file ONE course-correction directive.",
  "",
  "Rules:",
  "  - Exactly ONE directive. If no KPI is materially off-curve, return",
  "    { kind: 'no_action', payload: { reason } }.",
  "  - Drift threshold: |actual − projected| / projected ≥ 0.15.",
  "  - estimated_delta should be honest about the size of the recovery.",
  "  - priority is 'medium' or 'high'. NEVER 'critical'.",
  "  - Output shape on action:",
  "    { kind: 'new_issue', payload: { title, body, target_kpi,",
  "      drift_pct, estimated_delta, measurement_plan, priority,",
  "      assignee_role } }",
  "",
  "<UNTRUSTED-DATA>",
  JSON.stringify(decoded, null, 2),
  "</UNTRUSTED-DATA>",
  "",
  "Return ONLY the JSON object. No prose, no markdown fences.",
].join("\n");

const oauthToken = getOAuthToken();
console.error("  ✓ OAuth token retrieved from Keychain");
console.error("  → calling Anthropic " + MODEL + " (OAuth, NOT API key)…");

const t0 = Date.now();
const anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${oauthToken}`,
    "anthropic-beta": "oauth-2025-04-20",
    "anthropic-version": "2023-06-01",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: MODEL,
    max_tokens: 1500,
    messages: [{ role: "user", content: promptText }],
    system: "You are Claude Code, Anthropic's official CLI for Claude.",
  }),
});
const elapsedMs = Date.now() - t0;

if (!anthropicResp.ok) {
  const errText = await anthropicResp.text();
  console.error(`  ✗ Anthropic returned ${anthropicResp.status}`);
  console.error(`    body (truncated): ${errText.slice(0, 400)}`);
  process.stdout.write(JSON.stringify({
    status: "error",
    error_class: `http_${anthropicResp.status}`,
    elapsed_ms: elapsedMs,
    audit_fields: fieldsAccessed,
  }));
  process.exit(0);
}

const anthropicBody = await anthropicResp.json();
const responseText = anthropicBody.content.map((c) => c.type === "text" ? c.text : "").join("").trim();
console.error(`  ✓ Anthropic responded in ${elapsedMs}ms`);
console.error(`    input_tokens: ${anthropicBody.usage.input_tokens}, output_tokens: ${anthropicBody.usage.output_tokens}`);

let payload;
try {
  const cleaned = responseText.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  payload = JSON.parse(cleaned);
} catch (e) {
  console.error(`  ✗ model output not parseable JSON: ${e.message}`);
  process.stdout.write(JSON.stringify({
    status: "error",
    error_class: "output_not_json",
    raw_response: responseText.slice(0, 1000),
    audit_fields: fieldsAccessed,
  }));
  process.exit(0);
}

// no_action path — emit audit + usage only, no injection
if (payload.kind === "no_action") {
  process.stdout.write(JSON.stringify({
    status: "no_action",
    reason: payload.payload?.reason ?? "no material drift detected",
    usage: usageRow(anthropicBody, elapsedMs),
    audit: auditRow(fieldsAccessed, anthropicBody.id),
  }));
  console.error("=== done (no_action) ===");
  process.exit(0);
}

const injectionId = crypto.randomUUID();
const issuedAt = new Date().toISOString();
const canonicalInput = {
  id: injectionId,
  kind: payload.kind ?? "new_issue",
  payload: payload.payload ?? payload,
  issued_by_catalog_id: CATALOG_ID,
  issued_at: issuedAt,
};
const canonical = JSON.stringify(canonicalInput, Object.keys(canonicalInput).sort());
const sig = sodium.crypto_sign_detached(new TextEncoder().encode(canonical), signPriv);
const sigB64 = sodium.to_base64(sig, sodium.base64_variants.ORIGINAL);
console.error(`  ✓ signed Ed25519 (${sigB64.length} chars b64)`);

function usageRow(body, elapsed) {
  return {
    pool: "C",
    subscription_id,
    request_id: body.id,
    model: MODEL,
    prompt_tokens: body.usage.input_tokens,
    completion_tokens: body.usage.output_tokens,
    cache_read_tokens: body.usage.cache_read_input_tokens ?? 0,
    cache_creation_tokens: body.usage.cache_creation_input_tokens ?? 0,
    // Sonnet 4.5: $3/M input, $15/M output — constants already cents-per-token.
    cost_cents: Math.max(
      1,
      Math.round(
        body.usage.input_tokens * 0.0003 + body.usage.output_tokens * 0.0015,
      ),
    ),
    status: "ok",
    inference_backend: "oauth_max",
    elapsed_ms: elapsed,
  };
}

function auditRow(fields, requestId) {
  return {
    hired_agent_id: hire_id,
    digest_id,
    fields_accessed: fields,
    purpose: `${CATALOG_ID} drift correction — F.5 local worker run via Claude Max OAuth`,
    request_id: requestId,
  };
}

process.stdout.write(JSON.stringify({
  status: "ok",
  injection: {
    id: injectionId,
    subscription_id,
    hired_agent_id: hire_id,
    catalog_id: CATALOG_ID,
    kind: canonicalInput.kind,
    payload: canonicalInput.payload,
    issued_by_catalog_id: CATALOG_ID,
    issued_at: issuedAt,
    signature_b64: sigB64,
  },
  usage: usageRow(anthropicBody, elapsedMs),
  audit: auditRow(fieldsAccessed, anthropicBody.id),
}));
console.error("=== done ===");
