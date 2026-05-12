#!/usr/bin/env node
/**
 * Generate an X25519 keypair for a single Expert Agent.
 *
 * Output:
 *   - prints the public key (base64) to stdout — paste into Supabase via
 *     `node upload-public-key.mjs <catalog_id> <public_b64>`
 *   - writes the private key to the macOS Keychain under
 *     `wavex-os.expert-agent.<catalog_id>` so the per-catalog worker
 *     process can read it. The private key is NEVER written to disk and
 *     never logged.
 *
 * Run once per Expert Agent (4 times for V1: optimizer-v1, alignment-v1,
 * error-handler-v1, concierge-v1).
 *
 * Re-running for an existing catalog_id ROTATES the keypair — the old
 * private key is deleted from the Keychain, and customers with pending
 * fleet_digests addressed to the old public key will silently fail
 * decryption until they re-upload with the new public key. Use the
 * rotation procedure in docs/F4e_KEYPAIR_OPS.md for live rotation.
 */
import sodium from "libsodium-wrappers";
import { execSync } from "node:child_process";

const catalogId = process.argv[2];
if (!catalogId) {
  console.error("Usage: node generate-keypair.mjs <catalog_id>");
  console.error("Example: node generate-keypair.mjs optimizer-v1");
  process.exit(1);
}

if (!/^[a-z][a-z0-9-]+-v\d+$/.test(catalogId)) {
  console.error(`Catalog id "${catalogId}" doesn't look right.`);
  console.error('Expected pattern: lowercase + dashes + "-v<N>", e.g. "optimizer-v1"');
  process.exit(1);
}

await sodium.ready;

// X25519 keypair for libsodium sealed-box.
const { publicKey, privateKey } = sodium.crypto_box_keypair();
const publicB64 = sodium.to_base64(publicKey, sodium.base64_variants.ORIGINAL);
const privateB64 = sodium.to_base64(privateKey, sodium.base64_variants.ORIGINAL);

// Stash private in macOS Keychain. Replaces any prior entry for this id.
const service = `wavex-os.expert-agent.${catalogId}`;
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
console.log(`✓ Generated keypair for ${catalogId}`);
console.log(`  Private key: stored in macOS Keychain as "${service}"`);
console.log(`               retrievable via: security find-generic-password -s "${service}" -w`);
console.log(`  Public key:`);
console.log(`               ${publicB64}`);
console.log("");
console.log("Next steps:");
console.log(`  1) Upload the public key to Supabase:`);
console.log(`     SUPABASE_SERVICE_ROLE_KEY=... node scripts/expert-agents/upload-public-key.mjs ${catalogId} '${publicB64}'`);
console.log(`  2) Confirm with:`);
console.log(`     select id, recipient_public_key from wavex_os.expert_agent_catalog where id='${catalogId}';`);
console.log("");
console.log("NEVER paste the private key anywhere. NEVER commit it. The Keychain is its only home.");
