#!/usr/bin/env node
/**
 * Upload an Expert Agent's public key to Supabase wavex_os.expert_agent_catalog.
 *
 * Run AFTER generate-keypair.mjs printed the public key.
 *
 * Usage:
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/expert-agents/upload-public-key.mjs <catalog_id> <public_b64>
 */
import { createClient } from "@supabase/supabase-js";

const [, , catalogId, publicB64] = process.argv;
if (!catalogId || !publicB64) {
  console.error("Usage: node upload-public-key.mjs <catalog_id> <public_b64>");
  process.exit(1);
}
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in env");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

// We store the public key as a bytea, but it's easier to ship as base64 over
// JSON. Decode here, store as raw bytes.
const publicBuf = Buffer.from(publicB64, "base64");
if (publicBuf.length !== 32) {
  console.error(`Public key must be 32 bytes after base64 decode; got ${publicBuf.length}`);
  process.exit(1);
}

const { data, error } = await sb
  .schema("wavex_os")
  .from("expert_agent_catalog")
  .update({ recipient_public_key: `\\x${publicBuf.toString("hex")}` })
  .eq("id", catalogId)
  .select("id, recipient_public_key");

if (error) {
  console.error(`Update failed: ${error.message}`);
  process.exit(1);
}
if (!data || data.length === 0) {
  console.error(`No catalog row found for id "${catalogId}"`);
  process.exit(1);
}

console.log(`✓ Uploaded public key for ${catalogId} (${publicBuf.length} bytes)`);
console.log("");
console.log(`Verify with:`);
console.log(`  select id, length(recipient_public_key) from wavex_os.expert_agent_catalog where id='${catalogId}';`);
console.log(`  (should return 32)`);
