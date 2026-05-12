#!/usr/bin/env node
/**
 * verify-injection.mjs — validates a single signed injection from the
 * server-side Expert Agent worker before the Liaison posts it to local
 * Paperclip.
 *
 * Each injection payload has the shape:
 *   {
 *     "id": "<uuid>",
 *     "kind": "issue_comment" | "new_issue" | "workflow_proposal" |
 *             "spawn_throttle_call" | "human_escalation",
 *     "payload": { ... },           // the operational content
 *     "issued_by_catalog_id": "optimizer-v1",
 *     "issued_at": "<ISO timestamp>",
 *     "signature_b64": "<Ed25519 sig over canonical JSON of payload+kind+id+issued_at>"
 *   }
 *
 * The Liaison agent pins each catalog id's signing public key on first
 * hire — it lives at ~/.paperclip/state/expert-agent-pinned-keys.json.
 * verify-injection.mjs refuses to validate if the key has changed since
 * pinning. The customer must re-consent in Mission Control to update
 * the pinned key.
 *
 * Usage:
 *   echo '<injection JSON>' | node verify-injection.mjs
 * Exit 0 = valid, write the payload to stdout for the Liaison to post.
 * Exit 1 = invalid, error to stderr.
 */
import sodium from "libsodium-wrappers";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

const PIN_PATH = process.env.WAVEX_LIAISON_PIN_PATH ?? join(homedir(), ".paperclip", "state", "expert-agent-pinned-keys.json");

await sodium.ready;

const injection = JSON.parse(readFileSync(0, "utf8"));

const { id, kind, payload, issued_by_catalog_id, issued_at, signature_b64 } = injection;
if (!id || !kind || !payload || !issued_by_catalog_id || !issued_at || !signature_b64) {
  console.error("Injection missing required fields");
  process.exit(1);
}

// Load pinned keys
mkdirSync(dirname(PIN_PATH), { recursive: true });
let pins = {};
if (existsSync(PIN_PATH)) {
  pins = JSON.parse(readFileSync(PIN_PATH, "utf8"));
}

const expectedKeyB64 = process.env.WAVEX_LIAISON_EXPECTED_KEY_B64;
if (!expectedKeyB64) {
  console.error("WAVEX_LIAISON_EXPECTED_KEY_B64 required (fetched at heartbeat start from catalog)");
  process.exit(1);
}

// First-hire pinning: if no pin yet, accept and write.
if (!pins[issued_by_catalog_id]) {
  pins[issued_by_catalog_id] = { public_key_b64: expectedKeyB64, pinned_at: new Date().toISOString() };
  writeFileSync(PIN_PATH, JSON.stringify(pins, null, 2));
} else if (pins[issued_by_catalog_id].public_key_b64 !== expectedKeyB64) {
  // Refuse — customer must re-consent
  console.error(`Pinned key mismatch for ${issued_by_catalog_id}.`);
  console.error(`  pinned:   ${pins[issued_by_catalog_id].public_key_b64.slice(0, 20)}...`);
  console.error(`  expected: ${expectedKeyB64.slice(0, 20)}...`);
  console.error(`To accept the new key, revoke this Expert Agent in Mission Control and re-hire.`);
  process.exit(1);
}

// Verify signature
const publicKey = sodium.from_base64(expectedKeyB64, sodium.base64_variants.ORIGINAL);
const signature = sodium.from_base64(signature_b64, sodium.base64_variants.ORIGINAL);

// Canonical JSON for signing: sorted keys, no whitespace
const canonical = JSON.stringify({ id, kind, payload, issued_by_catalog_id, issued_at }, Object.keys({
  id, issued_at, issued_by_catalog_id, kind, payload,
}).sort());
const message = Buffer.from(canonical, "utf8");

const valid = sodium.crypto_sign_verify_detached(signature, message, publicKey);
if (!valid) {
  console.error(`Signature invalid for injection ${id} from ${issued_by_catalog_id}`);
  process.exit(1);
}

// Bound issued_at — refuse anything older than 1h to prevent replay
const ageMs = Date.now() - new Date(issued_at).getTime();
if (ageMs > 60 * 60 * 1000) {
  console.error(`Injection ${id} is ${Math.floor(ageMs / 60000)}m old, refusing (>1h replay window)`);
  process.exit(1);
}

// Valid — emit the payload for the caller to act on
process.stdout.write(JSON.stringify({ id, kind, payload, issued_by_catalog_id, issued_at }));
