/**
 * F.5 worker — code-engineer-v1, running locally on the Mac mini using
 * Claude Max OAuth instead of an API key.
 *
 * The advisory->operational expert (OPERATIONAL_LAYER.md §4). Unlike the
 * optimizer/alignment/error-handler/concierge workers — which file directives —
 * this one PROPOSES a code change or DB migration. It never writes a raw diff
 * against code it cannot see: it emits a STRUCTURED PROPOSAL (intent, target
 * files/tables, rationale, acceptance criteria). The customer's LOCAL Git
 * Engineer (Phase 9) implements it on the customer's box with the customer's
 * own GitHub + Supabase creds — the customer's code never enters WaveX infra.
 *
 * Matches the V2_CAPTURE_C architecture: Mac mini is the worker, Supabase is
 * the message bus, no keys ever leave the box.
 *
 * Stdin: JSON `{ envelopes, hire_id, digest_id, subscription_id }`
 * Stdout: JSON `{ injection, usage, audit }` for caller to insert via MCP
 * Stderr: human-readable progress (no secret values)
 */
import sodium from "libsodium-wrappers";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const CATALOG_ID = "code-engineer-v1";
const MODEL = "claude-sonnet-4-5";

await sodium.ready;

// ── 1. Retrieve OAuth token from Keychain (never echoed to stdout) ──
function getOAuthToken() {
  const raw = execSync(`security find-generic-password -s 'Claude Code-credentials' -w 2>/dev/null`, { encoding: "utf8" }).trim();
  const env = JSON.parse(raw);
  const expiresAt = env.claudeAiOauth.expiresAt;
  if (expiresAt && expiresAt < Date.now() + 60_000) {
    console.error(`  ! OAuth token expires in <60s; refresh needed (not implemented in this harness)`);
  }
  return env.claudeAiOauth.accessToken;
}

// ── 2. Load keypairs from Keychain ──
function loadKeys(catalogId) {
  const enc = execSync(`security find-generic-password -s 'wavex-os.expert-agent.${catalogId}' -w 2>/dev/null`, { encoding: "utf8" }).trim();
  const sign = execSync(`security find-generic-password -s 'wavex-os.expert-agent-sign.${catalogId}' -w 2>/dev/null`, { encoding: "utf8" }).trim();
  const encPriv = sodium.from_base64(enc, sodium.base64_variants.ORIGINAL);
  const signPriv = sodium.from_base64(sign, sodium.base64_variants.ORIGINAL);
  const encPub = sodium.crypto_scalarmult_base(encPriv);
  return { encPriv, signPriv, encPub };
}

// ── 3. Read stdin payload ──
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

// ── 4. Decrypt only code-engineer-v1's scope ──
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

// ── 5. Construct the proposal prompt ──
// Operational expert: emits a STRUCTURED PROPOSAL, not a diff. The local Git
// Engineer turns this into an actual PR on the customer's box.
const promptText = [
  "You are the WaveX Code Engineer. Read the customer's fleet state below (inside",
  "the UNTRUSTED-DATA fence) and propose EXACTLY ONE concrete change to their",
  "codebase or database that would remove a real bottleneck or fix a recurring",
  "failure visible in the digest.",
  "",
  "You are PROPOSING, not implementing. You cannot see their full code — never",
  "invent file contents or write a diff. Describe the change precisely enough",
  "that the customer's local Git Engineer can implement it and open a PR.",
  "",
  "Rules (canonical, do not violate):",
  "  - Exactly ONE proposal. Smallest change that addresses a real signal.",
  "  - kind is 'code_change' OR 'db_migration' (use db_migration only when the",
  "    fix is fundamentally a schema change).",
  "  - NEVER 'OVERRIDE'/'EMERGENCY'/'URGENT' framing. NEVER propose deleting",
  "    data, dropping tables, or force-pushing.",
  "  - The proposal must be reviewable: a human + the customer's own eng agents",
  "    review it before anything merges. PR-only, never direct-to-main.",
  "  - Output a JSON object with exactly these keys:",
  "    { kind: 'code_change' | 'db_migration',",
  "      payload: { title, intent, target_files (string[]), target_tables",
  "        (string[], empty for pure code_change), rationale, acceptance_criteria",
  "        (string[]), risk ('low'|'medium'|'high'), rollback, assignee_role } }",
  "",
  "<UNTRUSTED-DATA>",
  JSON.stringify(decoded, null, 2),
  "</UNTRUSTED-DATA>",
  "",
  "Return ONLY the JSON object. No prose, no markdown fences, no commentary.",
].join("\n");

// ── 6. Call Anthropic via OAuth (NOT API key) ──
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

// ── 7. Parse model output as JSON ──
let payload;
try {
  const cleaned = responseText.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  payload = JSON.parse(cleaned);
} catch (e) {
  console.error(`  ✗ model output not parseable JSON: ${e.message}`);
  console.error(`    raw response (first 500 chars): ${responseText.slice(0, 500)}`);
  process.stdout.write(JSON.stringify({
    status: "error",
    error_class: "output_not_json",
    raw_response: responseText.slice(0, 1000),
    audit_fields: fieldsAccessed,
  }));
  process.exit(0);
}

// Guard: only the two operational kinds are allowed out of this worker.
const kind = payload.kind === "db_migration" ? "db_migration" : "code_change";

// ── 8. Sign with Ed25519 ──
const injectionId = crypto.randomUUID();
const issuedAt = new Date().toISOString();
const canonicalInput = {
  id: injectionId,
  kind,
  payload: payload.payload ?? payload,
  issued_by_catalog_id: CATALOG_ID,
  issued_at: issuedAt,
};
const canonical = JSON.stringify(canonicalInput, Object.keys(canonicalInput).sort());
const sig = sodium.crypto_sign_detached(new TextEncoder().encode(canonical), signPriv);
const sigB64 = sodium.to_base64(sig, sodium.base64_variants.ORIGINAL);
console.error(`  ✓ signed Ed25519 (${sigB64.length} chars b64), kind=${kind}`);

// ── 9. Output for caller to insert ──
const output = {
  status: "ok",
  injection: {
    id: injectionId,
    subscription_id,
    hired_agent_id: hire_id,
    catalog_id: CATALOG_ID,
    kind,
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
    // Sonnet 4.5: $3/1M input, $15/1M output — constants are cents-per-token.
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
    purpose: "code-engineer-v1 code/DB change proposal — F.5 local worker run via Claude Max OAuth",
    request_id: anthropicBody.id,
  },
};
process.stdout.write(JSON.stringify(output));
console.error("=== done ===");
