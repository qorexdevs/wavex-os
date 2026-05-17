/** Vault crypto + service smoke tests. */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { _resetMasterKeyCache, encrypt, decrypt, infoFor } from "../src/vault/crypto.js";
import {
  writeCredential, readCredential, listConnectorStates,
  recordTestResult, skipConnector, _resetMigrationLatch,
} from "../src/vault/service.js";
import { _resetDbCache } from "@wavex-os/db";

let tempDir: string;
let dbDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "wavex-vault-test-"));
  dbDir = join(tempDir, "db");
  process.env.WAVEX_OS_STATE_DIR = tempDir;
  process.env.WAVEX_DB_DATA_DIR = dbDir;
  process.env.CREDENTIAL_VAULT_MASTER_KEY = "0".repeat(64);
  _resetMasterKeyCache();
  _resetDbCache();
  _resetMigrationLatch();
});

afterEach(() => {
  delete process.env.WAVEX_OS_STATE_DIR;
  delete process.env.WAVEX_DB_DATA_DIR;
  delete process.env.CREDENTIAL_VAULT_MASTER_KEY;
  rmSync(tempDir, { recursive: true, force: true });
});

describe("vault crypto", () => {
  it("round-trips plaintext via encrypt + decrypt", () => {
    const info = infoFor("co1", "supabase", "anon_key");
    const enc = encrypt("eyJhbGciOi…SECRET", info);
    expect(enc.ciphertext).toBeTruthy();
    expect(enc.iv).toBeTruthy();
    expect(enc.authTag).toBeTruthy();
    expect(enc.salt).toBeTruthy();
    const pt = decrypt(enc, info);
    expect(pt).toBe("eyJhbGciOi…SECRET");
  });

  it("decrypt with WRONG info string fails (HKDF binds info)", () => {
    const enc = encrypt("hello", "wavex/co1/supabase/url");
    expect(() => decrypt(enc, "wavex/co1/supabase/anon_key")).toThrow();
  });

  it("two encrypts of same plaintext produce different ciphertexts (random IV+salt)", () => {
    const info = infoFor("co1", "github", "pat");
    const a = encrypt("ghp_abc", info);
    const b = encrypt("ghp_abc", info);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.iv).not.toBe(b.iv);
    expect(a.salt).not.toBe(b.salt);
  });
});

describe("vault service", () => {
  it("write + read round-trips through DB", async () => {
    await writeCredential({
      companyId: "co-x", connectorId: "github", key: "pat", plaintext: "ghp_test",
    });
    const v = await readCredential({ companyId: "co-x", connectorId: "github", key: "pat" });
    expect(v).toBe("ghp_test");
  });

  it("listConnectorStates reports vaulted_unvalidated then vaulted_valid after test_ok", async () => {
    await writeCredential({ companyId: "co-x", connectorId: "supabase", key: "url", plaintext: "https://x.supabase.co" });
    await writeCredential({ companyId: "co-x", connectorId: "supabase", key: "anon_key", plaintext: "ey..." });

    let states = await listConnectorStates("co-x");
    expect(states.get("supabase")?.status).toBe("vaulted_unvalidated");
    expect(states.get("supabase")?.vaultedKeys.sort()).toEqual(["anon_key", "url"]);

    await recordTestResult({ companyId: "co-x", connectorId: "supabase", key: "default", ok: true, detail: "OK" });
    states = await listConnectorStates("co-x");
    expect(states.get("supabase")?.status).toBe("vaulted_valid");
    expect(states.get("supabase")?.lastTestResult).toEqual({ ok: true, detail: "OK" });
  });

  it("skipConnector marks status=skipped + records reason", async () => {
    await skipConnector({ companyId: "co-x", connectorId: "stripe", reason: "no billing yet" });
    const states = await listConnectorStates("co-x");
    expect(states.get("stripe")?.status).toBe("skipped");
    expect(states.get("stripe")?.skipReason).toBe("no billing yet");
  });

  it("writing after skip un-skips the connector", async () => {
    await skipConnector({ companyId: "co-x", connectorId: "stripe", reason: "later" });
    let states = await listConnectorStates("co-x");
    expect(states.get("stripe")?.status).toBe("skipped");

    await writeCredential({ companyId: "co-x", connectorId: "stripe", key: "secret_key", plaintext: "sk_test" });
    states = await listConnectorStates("co-x");
    expect(states.get("stripe")?.status).toBe("vaulted_unvalidated");
  });
});
