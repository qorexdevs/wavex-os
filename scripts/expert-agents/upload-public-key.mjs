#!/usr/bin/env node
/**
 * Upload an Expert Agent's public key to Supabase wavex_os.expert_agent_catalog.
 *
 * Run AFTER generate-keypair.mjs (encryption) or generate-signing-keypair.mjs
 * (signing) printed the public key.
 *
 * Usage:
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/expert-agents/upload-public-key.mjs [--type recipient|signing] <catalog_id> <public_b64>
 *
 *   --type recipient  (default) → recipient_public_key (X25519, decrypts digests)
 *   --type signing               → signing_public_key  (Ed25519, signs injections)
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// @supabase/supabase-js lives in packages/inference-server/node_modules (pnpm
// workspace, not hoisted). Resolve it from there so this runs from any cwd.
const _repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const _require = createRequire(join(_repoRoot, "packages", "inference-server", "package.json"));
const { createClient } = _require("@supabase/supabase-js");

const args = process.argv.slice(2);
let keyType = "recipient";
const typeIdx = args.indexOf("--type");
if (typeIdx !== -1) {
  keyType = args[typeIdx + 1];
  args.splice(typeIdx, 2);
}
const [catalogId, publicB64] = args;

if (!catalogId || !publicB64 || !["recipient", "signing"].includes(keyType)) {
  console.error("Usage: node upload-public-key.mjs [--type recipient|signing] <catalog_id> <public_b64>");
  process.exit(1);
}
const column = keyType === "signing" ? "signing_public_key" : "recipient_public_key";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in env");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

// Stored as bytea; ship as base64 over JSON, decode to raw bytes here.
// Both X25519 public and Ed25519 public keys are 32 bytes.
const publicBuf = Buffer.from(publicB64, "base64");
if (publicBuf.length !== 32) {
  console.error(`Public key must be 32 bytes after base64 decode; got ${publicBuf.length}`);
  process.exit(1);
}

const { data, error } = await sb
  .schema("wavex_os")
  .from("expert_agent_catalog")
  .update({ [column]: `\\x${publicBuf.toString("hex")}` })
  .eq("id", catalogId)
  .select(`id, ${column}`);

if (error) {
  console.error(`Update failed: ${error.message}`);
  process.exit(1);
}
if (!data || data.length === 0) {
  console.error(`No catalog row found for id "${catalogId}"`);
  process.exit(1);
}

console.log(`✓ Uploaded ${keyType} public key for ${catalogId} (${publicBuf.length} bytes → ${column})`);
console.log("");
console.log(`Verify with:`);
console.log(`  select id, length(${column}) from wavex_os.expert_agent_catalog where id='${catalogId}';`);
console.log(`  (should return 32)`);
