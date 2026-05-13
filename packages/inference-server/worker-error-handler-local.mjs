/**
 * F.5 worker — error-handler-v1, running locally on the Mac mini using
 * Claude Max OAuth instead of an API key.
 *
 * Catalog charter: reads failed run signatures and classifies clusters
 * (adapter drift vs harness regression vs KPI definition error vs
 * environmental). Files recovery comments and escalates true harness
 * regressions to operator. Growth+.
 *
 * Prompt source: docs/prompts/error-recovery-triage.md (canonical).
 *
 * Stdin: JSON `{ envelopes, hire_id, digest_id, subscription_id }`
 * Stdout: JSON `{ status, injection?, usage, audit }`
 * Stderr: human-readable progress (no secret values)
 */
import sodium from "libsodium-wrappers";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const CATALOG_ID = "error-handler-v1";
const MODEL = "claude-sonnet-4-5";
const ERRORS_WINDOW_HOURS = 24;

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

const promptText = [
  "You are triaging a cluster of failed agent runs in a customer's local",
  "WaveX OS fleet. Classify the cluster into ONE of four documented buckets",
  "and recommend ONE action.",
  "",
  `Fleet digest (last ${ERRORS_WINDOW_HOURS}h, fields you have scope for):`,
  "<UNTRUSTED-DATA>",
  JSON.stringify(decoded, null, 2),
  "</UNTRUSTED-DATA>",
  "",
  "Buckets:",
  "  1. adapter_drift — same single agent has ≥3 failures of same kind in window.",
  "  2. harness_regression — ≥2 different agents fail with the SAME error signature.",
  "  3. KPI_definition_error — recovery issues reference KPI of 0/NULL but no code error.",
  "  4. environmental — multiple agents fail with disk/RAM/network signatures.",
  "  unclear — cannot fit into one bucket with ≥0.6 confidence.",
  "",
  "Decision rules:",
  "  - 1 agent, ≥3 same-kind failures → adapter_drift",
  "  - ≥2 agents, same signature → harness_regression",
  "  - failures mention \"0 results\" / \"NULL\" / \"no data\" but no code error → KPI_definition_error",
  "  - failures mention ENOSPC / OOM / cannot connect / timeout localhost → environmental",
  "  - none of the above with ≥0.6 confidence → unclear",
  "",
  "Action format (always present):",
  "  - adapter_drift → kind=issue_comment, target=<agent slot>, body=brief evidence + recommendation",
  "  - harness_regression → kind=new_issue, priority=high, body=quote signatures + affected slots",
  "  - KPI_definition_error → kind=issue_comment, body=reference structural-vs-measured-zero",
  "  - environmental → kind=issue_comment, target=system-reliability, body=quote signatures",
  "  - unclear → kind=escalate_to_operator, body=evidence list + which-bucket-fits ask",
  "",
  "Required output JSON shape:",
  "{",
  '  "kind": "issue_comment" | "new_issue" | "escalate_to_operator",',
  '  "payload": {',
  '    "cluster_classification": "adapter_drift" | "harness_regression" | "KPI_definition_error" | "environmental" | "unclear",',
  '    "evidence": ["string"],',
  '    "affected_agents": ["string"],',
  '    "recommended_action": { "kind": "...", "target": "...", "body": "..." },',
  '    "confidence": 0-1,',
  '    "operator_alert_required": boolean',
  "  }",
  "}",
  "",
  "Be conservative with confidence. If guessing, set < 0.6 and escalate.",
  "Return ONLY the JSON object.",
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
    max_tokens: 2000,
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

const injectionId = crypto.randomUUID();
const issuedAt = new Date().toISOString();
const canonicalInput = {
  id: injectionId,
  kind: payload.kind ?? "issue_comment",
  payload: payload.payload ?? payload,
  issued_by_catalog_id: CATALOG_ID,
  issued_at: issuedAt,
};
const canonical = JSON.stringify(canonicalInput, Object.keys(canonicalInput).sort());
const sig = sodium.crypto_sign_detached(new TextEncoder().encode(canonical), signPriv);
const sigB64 = sodium.to_base64(sig, sodium.base64_variants.ORIGINAL);
console.error(`  ✓ signed Ed25519 (${sigB64.length} chars b64)`);

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
  usage: {
    pool: "C",
    subscription_id,
    request_id: anthropicBody.id,
    model: MODEL,
    prompt_tokens: anthropicBody.usage.input_tokens,
    completion_tokens: anthropicBody.usage.output_tokens,
    cache_read_tokens: anthropicBody.usage.cache_read_input_tokens ?? 0,
    cache_creation_tokens: anthropicBody.usage.cache_creation_input_tokens ?? 0,
    cost_cents: Math.max(
      1,
      Math.round(
        anthropicBody.usage.input_tokens * 0.0003 +
          anthropicBody.usage.output_tokens * 0.0015,
      ),
    ),
    status: "ok",
    inference_backend: "oauth_max",
    elapsed_ms: elapsedMs,
  },
  audit: {
    hired_agent_id: hire_id,
    digest_id,
    fields_accessed: fieldsAccessed,
    purpose: `${CATALOG_ID} cluster triage — F.5 local worker run via Claude Max OAuth`,
    request_id: anthropicBody.id,
  },
}));
console.error("=== done ===");
