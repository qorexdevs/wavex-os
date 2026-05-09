/** Credential vault crypto.
 *
 *  AES-256-GCM encryption with per-credential HKDF-SHA256 derived keys.
 *  - Master key: from CREDENTIAL_VAULT_MASTER_KEY env (64 hex chars / 32 bytes)
 *    OR auto-generated + persisted at $WAVEX_OS_STATE_DIR/vault.key on first
 *    use. The auto-generated key is local-only; if you back up wavex state
 *    to elsewhere, treat vault.key with the same care as a private key.
 *  - Per-credential salt: 16 bytes random, stored alongside ciphertext.
 *  - HKDF-SHA256 derives a per-credential 32-byte key from
 *    (master, salt, info=`wavex/<companyId>/<connectorId>/<key>`).
 *  - AES-GCM IV: 12 bytes random.
 *  - AuthTag: 16 bytes appended by GCM mode.
 *
 *  Plaintext NEVER hits disk outside the encrypted ciphertext field.
 *  Logs / audit log NEVER record plaintext. */

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

let cachedMasterKey: Buffer | undefined;

function getMasterKeyPath(): string {
  const root = process.env.WAVEX_OS_STATE_DIR ?? join(homedir(), ".wavex-os");
  return join(root, "vault.key");
}

export function getMasterKey(): Buffer {
  if (cachedMasterKey) return cachedMasterKey;
  const fromEnv = process.env.CREDENTIAL_VAULT_MASTER_KEY;
  if (fromEnv) {
    if (!/^[0-9a-fA-F]{64}$/.test(fromEnv)) {
      throw new Error("CREDENTIAL_VAULT_MASTER_KEY must be 64 hex chars (32 bytes)");
    }
    cachedMasterKey = Buffer.from(fromEnv, "hex");
    return cachedMasterKey;
  }
  const path = getMasterKeyPath();
  if (existsSync(path)) {
    cachedMasterKey = Buffer.from(readFileSync(path, "utf8").trim(), "hex");
    return cachedMasterKey;
  }
  // First-use: generate + persist (file mode 0600)
  mkdirSync(dirname(path), { recursive: true });
  const fresh = randomBytes(32);
  writeFileSync(path, fresh.toString("hex"), "utf8");
  chmodSync(path, 0o600);
  cachedMasterKey = fresh;
  return cachedMasterKey;
}

/** Test-only — drop the cached key so a new env var takes effect. */
export function _resetMasterKeyCache(): void {
  cachedMasterKey = undefined;
}

export interface EncryptedRecord {
  ciphertext: string; // base64
  iv: string;         // base64 (12 bytes)
  authTag: string;    // base64 (16 bytes)
  salt: string;       // base64 (16 bytes)
}

function deriveKey(master: Buffer, salt: Buffer, info: string): Buffer {
  const derived = hkdfSync("sha256", master, salt, Buffer.from(info, "utf8"), 32);
  return Buffer.from(derived);
}

export function encrypt(plaintext: string, info: string): EncryptedRecord {
  const master = getMasterKey();
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = deriveKey(master, salt, info);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: ct.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    salt: salt.toString("base64"),
  };
}

export function decrypt(rec: EncryptedRecord, info: string): string {
  const master = getMasterKey();
  const salt = Buffer.from(rec.salt, "base64");
  const iv = Buffer.from(rec.iv, "base64");
  const authTag = Buffer.from(rec.authTag, "base64");
  const ct = Buffer.from(rec.ciphertext, "base64");
  const key = deriveKey(master, salt, info);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

export function infoFor(companyId: string, connectorId: string, key: string): string {
  return `wavex/${companyId}/${connectorId}/${key}`;
}
