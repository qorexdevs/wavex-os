#!/usr/bin/env node
/**
 * encrypt-envelopes.mjs — reads a fleet digest from stdin, reads the
 * customer's active hired Expert Agents from Supabase, and outputs a
 * `field_envelopes` JSON object suitable for POST to
 * /rest/v1/wavex_os.fleet_digests.
 *
 * For each digest field, builds a sealed-box envelope per hired agent
 * whose `data_scope` includes that field. Fields with no recipient are
 * dropped entirely — plaintext never leaves the customer Mac if no one
 * is paying to read it.
 *
 * Output shape:
 *   {
 *     "kpi_snapshots": {
 *        "recipients": [{ "catalog_id": "optimizer-v1", "ciphertext_b64": "..." }],
 *        "field_hash": "<sha256 of plaintext, for receipt verification>"
 *     },
 *     ...
 *   }
 *
 * Env required:
 *   - SUPABASE_URL
 *   - SUPABASE_ANON_KEY (uses the customer's session JWT for RLS)
 *   - SUPABASE_ACCESS_TOKEN (the customer's session token; signed-in user)
 *   - SUBSCRIPTION_ID (the customer's active subscription)
 *
 * Stdin: one JSON object (the digest from build-digest.mjs)
 * Stdout: one JSON object (the field_envelopes payload)
 * Exit 0 on success, 1 on error.
 */
import sodium from "libsodium-wrappers";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const SUBSCRIPTION_ID = process.env.SUBSCRIPTION_ID;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_ACCESS_TOKEN || !SUBSCRIPTION_ID) {
  console.error("Required env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_ACCESS_TOKEN, SUBSCRIPTION_ID");
  process.exit(1);
}

await sodium.ready;

const digest = JSON.parse(readFileSync(0, "utf8"));

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { headers: { Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}` } },
  auth: { persistSession: false, autoRefreshToken: false },
});

// Fetch active hires joined to catalog (so we get scope + public key).
const { data: hires, error: hireErr } = await sb
  .schema("wavex_os")
  .from("hired_expert_agents")
  .select("catalog_id, expert_agent_catalog (id, data_scope, recipient_public_key)")
  .eq("subscription_id", SUBSCRIPTION_ID)
  .eq("status", "active");

if (hireErr) {
  console.error(`Hire lookup failed: ${hireErr.message}`);
  process.exit(1);
}

if (!hires || hires.length === 0) {
  // No active hires → no envelopes to build.
  process.stdout.write(JSON.stringify({}));
  process.exit(0);
}

// Build a field → [recipient] map.
const fieldRecipients = {}; // { fieldName: [{ catalog_id, publicKey: Uint8Array }] }
for (const h of hires) {
  const c = h.expert_agent_catalog;
  if (!c?.recipient_public_key) continue;
  // Supabase returns bytea as "\\x<hex>" string.
  const hex = String(c.recipient_public_key).replace(/^\\x/, "");
  const publicKey = Buffer.from(hex, "hex");
  if (publicKey.length !== 32) {
    console.error(`Catalog ${c.id} has invalid public key length: ${publicKey.length}`);
    continue;
  }
  for (const field of c.data_scope ?? []) {
    if (!fieldRecipients[field]) fieldRecipients[field] = [];
    fieldRecipients[field].push({ catalog_id: c.id, publicKey });
  }
}

// Build envelopes per field.
const envelopes = {};
for (const [field, plaintext] of Object.entries(digest)) {
  const recipients = fieldRecipients[field];
  if (!recipients || recipients.length === 0) continue; // no one reads this field

  const plaintextBytes = Buffer.from(JSON.stringify(plaintext), "utf8");
  const fieldHash = createHash("sha256").update(plaintextBytes).digest("hex");

  const sealedRecipients = recipients.map(({ catalog_id, publicKey }) => {
    const cipher = sodium.crypto_box_seal(plaintextBytes, publicKey);
    return {
      catalog_id,
      ciphertext_b64: Buffer.from(cipher).toString("base64"),
    };
  });

  envelopes[field] = {
    recipients: sealedRecipients,
    field_hash: fieldHash,
  };
}

process.stdout.write(JSON.stringify(envelopes));
