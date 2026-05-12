/**
 * Expert Worker — optimizer-v1 (F.5 reference impl).
 *
 * Cron-triggered every 30min via Supabase scheduled functions.
 * Per active customer that hired optimizer-v1:
 *   1. Read latest fleet_digests row for that subscription
 *   2. Decrypt the field_envelopes addressed to optimizer-v1 only
 *   3. Write digest_access_log audit row
 *   4. Construct prompt from docs/prompts/optimizer-board-nudge.md
 *   5. Call Anthropic
 *   6. Sign the output with optimizer-v1's Ed25519 signing key
 *   7. Insert into injection_queue_v2
 *   8. Write usage_ledger row
 *
 * Secrets required (set via `supabase secrets set`):
 *   ANTHROPIC_API_KEY                  — Anthropic API key (operator's)
 *   OPTIMIZER_V1_ENC_PRIVATE_B64       — X25519 private (libsodium sealed-box decrypt)
 *   OPTIMIZER_V1_SIGN_PRIVATE_B64      — Ed25519 private (signature on injection)
 *   SUPABASE_URL (auto)
 *   SUPABASE_SERVICE_ROLE_KEY (auto)
 *
 * Returns 503 with diagnostic message if any required secret is missing,
 * so the loop validates cleanly without the operator forcing live
 * inference before they're ready.
 */
// @ts-expect-error — Deno-style imports
import sodium from "https://esm.sh/libsodium-wrappers@0.7.13";
// @ts-expect-error — Deno-style imports
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.95.2?target=denonext";
// @ts-expect-error — Deno-style imports
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.1";

const CATALOG_ID = "optimizer-v1";
const PROMPT_TEMPLATE_PATH = "docs/prompts/optimizer-board-nudge.md";
const MODEL = "claude-sonnet-4-6";
const MAX_OUTPUT_TOKENS = 4000;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const ENC_PRIVATE_B64 = Deno.env.get("OPTIMIZER_V1_ENC_PRIVATE_B64");
const SIGN_PRIVATE_B64 = Deno.env.get("OPTIMIZER_V1_SIGN_PRIVATE_B64");

const sb = createClient(SUPABASE_URL, SUPABASE_SVC, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface FleetDigest {
  id: string;
  subscription_id: string;
  field_envelopes: Record<string, { recipients: Array<{ catalog_id: string; ciphertext_b64: string }>; field_hash: string }>;
  received_at: string;
}

interface HiredAgent {
  id: string;
  subscription_id: string;
  catalog_id: string;
  status: string;
}

function jsonResp(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function processOneHire(hire: HiredAgent, encPrivate: Uint8Array, signPrivate: Uint8Array, encPublic: Uint8Array): Promise<{ status: string; reason?: string; injection_id?: string }> {
  // 1. Read latest digest for this subscription
  const { data: digests, error: dErr } = await sb
    .schema("wavex_os")
    .from("fleet_digests")
    .select("id, subscription_id, field_envelopes, received_at")
    .eq("subscription_id", hire.subscription_id)
    .gt("ttl_at", new Date().toISOString())
    .not("field_envelopes", "is", null)
    .order("received_at", { ascending: false })
    .limit(1);

  if (dErr) return { status: "error", reason: `digest read failed: ${dErr.message}` };
  if (!digests || digests.length === 0) return { status: "skipped", reason: "no fresh digest for this customer" };

  const digest = digests[0] as FleetDigest;

  // 2. Decrypt only fields addressed to optimizer-v1
  const decoded: Record<string, unknown> = {};
  for (const [field, envelope] of Object.entries(digest.field_envelopes ?? {})) {
    const myRecipient = envelope.recipients?.find((r) => r.catalog_id === CATALOG_ID);
    if (!myRecipient) continue;
    try {
      const cipher = sodium.from_base64(myRecipient.ciphertext_b64, sodium.base64_variants.ORIGINAL);
      const plain = sodium.crypto_box_seal_open(cipher, encPublic, encPrivate);
      decoded[field] = JSON.parse(new TextDecoder().decode(plain));
    } catch (e) {
      return { status: "error", reason: `decrypt failed for field ${field}: ${(e as Error).message}` };
    }
  }
  if (Object.keys(decoded).length === 0) {
    return { status: "skipped", reason: "no fields addressed to optimizer-v1 in latest digest" };
  }

  // 3. Audit row
  await sb.schema("wavex_os").from("digest_access_log").insert({
    hired_agent_id: hire.id,
    digest_id: digest.id,
    fields_accessed: Object.keys(decoded),
    purpose: "optimizer-v1 board nudge cycle",
  });

  // 4-5. Construct prompt + call Anthropic (when key is set)
  if (!ANTHROPIC_KEY) {
    return { status: "skipped_no_anthropic", reason: "ANTHROPIC_API_KEY not configured; digest access logged but no injection generated" };
  }

  const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

  const promptParts: string[] = [
    "You are the WaveX Optimizer. Your job: read the customer's fleet state below (inside the UNTRUSTED-DATA fence) and file ONE board-level direction that moves the meta-goal.",
    "",
    "Rules per docs/prompts/optimizer-board-nudge.md (canonical):",
    "  - Exactly ONE directive. No multi-step plans.",
    "  - Aim DIRECTLY at the bottleneck KPI.",
    "  - priority MUST be 'medium' or 'high'. NEVER 'critical'.",
    "  - NEVER use 'OVERRIDE', 'EMERGENCY', 'URGENT' framing.",
    "  - Honest estimated_delta. First-cycle deltas are small.",
    "  - Output a JSON object: { kind: 'new_issue' | 'issue_comment', payload: {...} }",
    "",
    "<UNTRUSTED-DATA>",
    JSON.stringify(decoded, null, 2),
    "</UNTRUSTED-DATA>",
    "",
    "Return ONLY the JSON object. No prose, no markdown fences.",
  ];

  let anthropicResp;
  try {
    anthropicResp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      messages: [{ role: "user", content: promptParts.join("\n") }],
    });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    await sb.schema("wavex_os").from("usage_ledger").insert({
      pool: "C", subscription_id: hire.subscription_id, request_id: null,
      model: MODEL, prompt_tokens: 0, completion_tokens: 0,
      cache_read_tokens: 0, cache_creation_tokens: 0, cost_cents: 0,
      status: "error", error_class: err.status ? `http_${err.status}` : "unknown",
    });
    return { status: "error", reason: `anthropic call failed: ${err.message}` };
  }

  const content = anthropicResp.content.map((c: { type: string; text?: string }) =>
    c.type === "text" ? c.text ?? "" : "").join("");

  let payload: { kind: string; payload: unknown };
  try {
    payload = JSON.parse(content);
  } catch (e) {
    return { status: "error", reason: `model output not JSON: ${(e as Error).message}` };
  }

  // 6. Sign
  const canonicalInput = {
    id: crypto.randomUUID(),
    kind: payload.kind,
    payload: payload.payload,
    issued_by_catalog_id: CATALOG_ID,
    issued_at: new Date().toISOString(),
  };
  const canonical = JSON.stringify(canonicalInput, Object.keys(canonicalInput).sort());
  const sig = sodium.crypto_sign_detached(new TextEncoder().encode(canonical), signPrivate);
  const sigB64 = sodium.to_base64(sig, sodium.base64_variants.ORIGINAL);

  // 7. Queue
  const { error: qErr } = await sb.schema("wavex_os").from("injection_queue_v2").insert({
    id: canonicalInput.id,
    subscription_id: hire.subscription_id,
    hired_agent_id: hire.id,
    catalog_id: CATALOG_ID,
    kind: canonicalInput.kind,
    payload: canonicalInput.payload,
    issued_by_catalog_id: CATALOG_ID,
    issued_at: canonicalInput.issued_at,
    signature_b64: sigB64,
  });
  if (qErr) return { status: "error", reason: `queue insert failed: ${qErr.message}` };

  // 8. Usage ledger
  const cost = Math.round(
    (anthropicResp.usage.input_tokens * 0.0003 + anthropicResp.usage.output_tokens * 0.0015) * 100
  );
  await sb.schema("wavex_os").from("usage_ledger").insert({
    pool: "C", subscription_id: hire.subscription_id, request_id: anthropicResp.id,
    model: MODEL,
    prompt_tokens: anthropicResp.usage.input_tokens,
    completion_tokens: anthropicResp.usage.output_tokens,
    cache_read_tokens: 0, cache_creation_tokens: 0,
    cost_cents: cost, status: "ok",
  });

  return { status: "ok", injection_id: canonicalInput.id };
}

Deno.serve(async (_req: Request) => {
  if (!ENC_PRIVATE_B64 || !SIGN_PRIVATE_B64) {
    return jsonResp({
      error: "secrets_not_configured",
      message: "OPTIMIZER_V1_ENC_PRIVATE_B64 and OPTIMIZER_V1_SIGN_PRIVATE_B64 must be set via `supabase secrets set`. See docs/F4E_KEYPAIR_OPS.md.",
    }, 503);
  }

  await sodium.ready;

  const encPrivate = sodium.from_base64(ENC_PRIVATE_B64, sodium.base64_variants.ORIGINAL);
  const signPrivate = sodium.from_base64(SIGN_PRIVATE_B64, sodium.base64_variants.ORIGINAL);

  // Derive the encryption public key from the private key for sealed-box decrypt
  const encPublic = sodium.crypto_scalarmult_base(encPrivate);

  // List all active hires for optimizer-v1
  const { data: hires, error: hErr } = await sb
    .schema("wavex_os")
    .from("hired_expert_agents")
    .select("id, subscription_id, catalog_id, status")
    .eq("catalog_id", CATALOG_ID)
    .eq("status", "active");

  if (hErr) return jsonResp({ error: "hire_list_failed", message: hErr.message }, 500);

  const results: Array<{ hire_id: string; status: string; reason?: string; injection_id?: string }> = [];
  for (const hire of (hires ?? []) as HiredAgent[]) {
    const r = await processOneHire(hire, encPrivate, signPrivate, encPublic);
    results.push({ hire_id: hire.id, ...r });
  }

  return jsonResp({
    ok: true,
    catalog_id: CATALOG_ID,
    processed: results.length,
    results,
  });
});
