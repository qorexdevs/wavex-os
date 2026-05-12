# F.4.e — Expert Agent Keypair Operator Runbook

One-time setup + rotation procedure for the X25519 keypairs that the per-catalog server-side workers use to decrypt customer fleet digests.

This runbook is for **WaveX team operators only**. Customers never touch keypairs — their Liaison agent reads `recipient_public_key` from Supabase at runtime.

## Threat model

The encryption defends against:

1. **Supabase service-role key compromise.** An attacker with full DB access reads only ciphertext. They cannot decrypt without the per-catalog worker's private key, which lives in the operator's macOS Keychain.
2. **WaveX insider threat.** Engineers cannot directly query plaintext fleet data via Supabase Studio or psql. Only the per-catalog worker process can decrypt, and every read writes a `digest_access_log` row.
3. **Cross-catalog data leakage.** `optimizer-v1`'s worker holds only its own private key. It cannot decrypt fields scoped to `concierge-v1`, even though both serve the same customer.

The encryption does NOT defend against compromise of the macOS Keychain itself (operator's local box). That's the inner trust boundary — if the operator's Mac is rooted, the game is over anyway.

## One-time setup (initial deployment)

Run **once** per Expert Agent in the catalog. For V1 that's four times.

### 1. Generate keypair

```bash
cd ~/wavex-os
pnpm --filter @wavex-os/inference-server exec node -e "require('libsodium-wrappers').then(()=>{})"  # warm up
node scripts/expert-agents/generate-keypair.mjs optimizer-v1
```

Output:

```
✓ Generated keypair for optimizer-v1
  Private key: stored in macOS Keychain as "wavex-os.expert-agent.optimizer-v1"
               retrievable via: security find-generic-password -s "wavex-os.expert-agent.optimizer-v1" -w
  Public key:
               YnpQU5h2VqRkN3...
```

The private key is in the Keychain. It will NEVER be written anywhere else. Don't copy it. Don't email it.

### 2. Upload public key to Supabase

```bash
SUPABASE_URL=https://<your-ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJ... \
  node scripts/expert-agents/upload-public-key.mjs optimizer-v1 'YnpQU5h2VqRkN3...'
```

Verify:

```sql
select id, length(recipient_public_key) from wavex_os.expert_agent_catalog where id='optimizer-v1';
-- should return 32 (bytes)
```

### 3. Repeat for the other three

```bash
node scripts/expert-agents/generate-keypair.mjs alignment-v1
# (then upload its public key)

node scripts/expert-agents/generate-keypair.mjs error-handler-v1
# (then upload its public key)

node scripts/expert-agents/generate-keypair.mjs concierge-v1
# (then upload its public key)
```

### 4. Confirm all four

```sql
select id, length(recipient_public_key) as key_bytes
from wavex_os.expert_agent_catalog
order by id;
-- expect 4 rows, all with key_bytes = 32
```

## Rotation procedure (when a key gets rotated)

You should rotate a key if:

- The Mac the operator runs has been compromised, or you suspect it has.
- The private key was ever logged or printed outside the Keychain (it shouldn't be, but accidents happen).
- A worker version bump materially changes what the catalog promises customers (in which case bump the catalog `id`, e.g. `optimizer-v1` → `optimizer-v2`, and treat as a fresh setup).

Rotation procedure:

1. **Communicate.** Tell active customers via Mission Control banner: "We're rotating `<catalog_id>`'s key on `<date>`. Pending injections in flight will be re-issued on the next cycle."
2. **Generate new keypair.**
   ```bash
   node scripts/expert-agents/generate-keypair.mjs optimizer-v1   # overwrites old Keychain entry
   ```
3. **Upload new public key** (replaces old):
   ```bash
   node scripts/expert-agents/upload-public-key.mjs optimizer-v1 '<new_public_b64>'
   ```
4. **Restart the worker process** (Phase F.5+):
   ```bash
   launchctl kickstart -k gui/$(id -u)/com.wavex-os.expert-worker.optimizer-v1
   ```
5. **Customer Liaisons pick up the new key automatically** on their next 5-min heartbeat. No customer action required.

**What happens to in-flight digests:**
- Fleet digests addressed to the OLD public key are now unreadable by the NEW worker.
- They TTL out after 24h.
- The Liaison's next upload uses the NEW public key — recovery is automatic, no data loss, max 5 min of injection latency.

**What happens to Liaison-pinned keys:**
- `verify-injection.mjs` pins each catalog's SIGNING public key (separate from the encryption key) on first hire.
- When you rotate the SIGNING key, customers must re-consent (revoke + re-hire) to update the pin.
- Encryption-only rotation (this runbook) does NOT require re-consent because the Liaison doesn't pin encryption keys.

## Backup procedure

Once per quarter, dump the Keychain entries to an encrypted backup:

```bash
for cid in optimizer-v1 alignment-v1 error-handler-v1 concierge-v1; do
  PK=$(security find-generic-password -s "wavex-os.expert-agent.$cid" -w 2>/dev/null)
  echo "$cid: $PK"
done | gpg --symmetric --armor --output ~/wavex-os-keys-$(date +%Y%m%d).asc
```

Store the .asc file somewhere offline. The passphrase should be different from any password used for the operator's normal account access.

To restore from backup (e.g. after replacing the Mac):

```bash
gpg --decrypt ~/wavex-os-keys-20260512.asc | while IFS=': ' read CID PK; do
  security add-generic-password -a wavex-expert-worker -s "wavex-os.expert-agent.$CID" -w "$PK"
done
```

## Day-2 audit

Once a week, sanity-check:

```sql
-- Are all catalog public keys 32 bytes?
select id, length(recipient_public_key) from wavex_os.expert_agent_catalog;

-- When was the last digest_access_log per catalog?
select hea.catalog_id, max(dal.accessed_at) as last_access
from wavex_os.digest_access_log dal
join wavex_os.hired_expert_agents hea on hea.id = dal.hired_agent_id
group by hea.catalog_id;

-- Any subscriptions with active hires but zero recent access? (worker dead?)
select s.id, count(*) as active_hires, max(dal.accessed_at) as last_seen
from wavex_os.subscriptions s
join wavex_os.hired_expert_agents hea on hea.subscription_id = s.id and hea.status = 'active'
left join wavex_os.digest_access_log dal on dal.hired_agent_id = hea.id
group by s.id
having max(dal.accessed_at) < now() - interval '24 hours' or max(dal.accessed_at) is null;
```

Any rows in the third query are customers whose Liaison is uploading but no worker is decrypting. Investigate the catalog's worker process.
