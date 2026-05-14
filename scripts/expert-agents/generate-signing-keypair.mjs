#!/usr/bin/env node
/**
 * Generate an Ed25519 SIGNING keypair for a single Expert Agent.
 *
 * Companion to generate-keypair.mjs (which does the X25519 ENCRYPTION
 * keypair). Every Expert Agent needs BOTH:
 *   - X25519 (encryption) — wavex-os.expert-agent.<id>      — decrypts digests
 *   - Ed25519 (signing)   — wavex-os.expert-agent-sign.<id> — signs injections
 *
 * The signing keypair is what the customer's Liaison pins and verifies
 * (verify-injection.mjs) before delivering any injection. An Expert Agent
 * with no signing key cannot issue a deliverable injection at all.
 *
 * Output:
 *   - prints the signing PUBLIC key (base64) to stdout — upload it with
 *     `node upload-public-key.mjs --type signing <catalog_id> <public_b64>`
 *   - writes the 64-byte Ed25519 SECRET key to the macOS Keychain under
 *     `wavex-os.expert-agent-sign.<catalog_id>`. Never written to disk,
 *     never logged.
 *
 * Re-running for an existing catalog_id ROTATES the signing key. Unlike
 * encryption-key rotation, rotating a SIGNING key invalidates the Liaison's
 * pin — customers must revoke + re-hire to re-consent. See
 * docs/F4E_KEYPAIR_OPS.md.
 */
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// libsodium-wrappers lives in packages/inference-server/node_modules (pnpm
// workspace, not hoisted). Resolve it from there so this script runs from any
// cwd. scripts/expert-agents/<this> → repo root is ../..
const _repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const _require = createRequire(join(_repoRoot, "packages", "inference-server", "package.json"));
const sodium = _require("libsodium-wrappers");

const catalogId = process.argv[2];
if (!catalogId) {
  console.error("Usage: node generate-signing-keypair.mjs <catalog_id>");
  console.error("Example: node generate-signing-keypair.mjs code-engineer-v1");
  process.exit(1);
}

if (!/^[a-z][a-z0-9-]+-v\d+$/.test(catalogId)) {
  console.error(`Catalog id "${catalogId}" doesn't look right.`);
  console.error('Expected pattern: lowercase + dashes + "-v<N>", e.g. "code-engineer-v1"');
  process.exit(1);
}

await sodium.ready;

// Ed25519 keypair for libsodium detached signatures.
const { publicKey, privateKey } = sodium.crypto_sign_keypair();
const publicB64 = sodium.to_base64(publicKey, sodium.base64_variants.ORIGINAL);
const privateB64 = sodium.to_base64(privateKey, sodium.base64_variants.ORIGINAL);

// Stash the 64-byte secret key in the macOS Keychain. Replaces any prior entry.
const service = `wavex-os.expert-agent-sign.${catalogId}`;
try {
  execSync(`security delete-generic-password -s "${service}" 2>/dev/null || true`, { stdio: "ignore" });
  execSync(
    `security add-generic-password -a wavex-expert-worker -s "${service}" -w "${privateB64}"`,
    { stdio: "ignore" },
  );
} catch (e) {
  console.error(`Failed to write Keychain entry: ${e.message}`);
  process.exit(1);
}

console.log("");
console.log(`✓ Generated SIGNING keypair for ${catalogId}`);
console.log(`  Secret key:  stored in macOS Keychain as "${service}"`);
console.log(`               retrievable via: security find-generic-password -s "${service}" -w`);
console.log(`  Public key:`);
console.log(`               ${publicB64}`);
console.log("");
console.log("Next steps:");
console.log(`  1) Upload the signing public key to Supabase:`);
console.log(`     SUPABASE_SERVICE_ROLE_KEY=... node scripts/expert-agents/upload-public-key.mjs --type signing ${catalogId} '${publicB64}'`);
console.log(`  2) Confirm with:`);
console.log(`     select id, length(signing_public_key) from wavex_os.expert_agent_catalog where id='${catalogId}';`);
console.log("");
console.log("NEVER paste the secret key anywhere. NEVER commit it. The Keychain is its only home.");
