# WaveX Expert Agent Processing Agreement

**Version:** 1.0
**Effective date:** 2026-05-12
**Counterparty:** WaveX, Inc.

This Agreement covers the processing of your fleet data by a specific WaveX Expert Agent that you hire. Each Expert Agent you hire is a separate consent event under this Agreement. By checking the consent box on the pricing page before completing Stripe Checkout, you agree to the terms below FOR THE SPECIFIC AGENT(S) YOU ARE HIRING.

You can revoke any Expert Agent at any time via Mission Control → Privacy Panel → Revoke. Revocation deletes pending fleet_digests within 1 hour and stops further processing.

This Agreement supplements the [WaveX OS Open Source Privacy Notice](./OPEN_SOURCE_NOTICE.md), which continues to apply to all data outside the explicit scope of each hired Expert Agent.

---

## 1. What the Expert Agent does

When you hire an Expert Agent, your local WaveX OS installation (specifically the Liaison agent running in your Paperclip instance) will:

1. Build a "fleet digest" — a JSON snapshot of selected fields of your fleet state — once every 5 minutes.
2. Encrypt each field of the digest using **libsodium sealed-box encryption**, addressed to the X25519 public key of the specific Expert Agent(s) you hired. Other agents' public keys cannot decrypt fields not addressed to them.
3. Upload the encrypted envelopes to `wavex_os.fleet_digests` on Supabase (sub-processor: see Section 5).
4. Server-side worker processes belonging to the hired Expert Agent's catalog entry will:
   - Decrypt only the fields addressed to that agent
   - Write an audit row to `wavex_os.digest_access_log` (which you can read via Mission Control's Privacy Panel)
   - Call Anthropic's API with the decrypted snippet inside a fenced "untrusted data" prompt block
   - Receive a generated output (issue comment, new issue, or workflow proposal)
   - Cryptographically sign the output and place it on `wavex_os.injection_queue`
5. Your Liaison agent polls the queue, verifies the signature, and posts the output to your local Paperclip as a comment or issue.

---

## 2. Data scope per Expert Agent (the contract you are consenting to)

Each Expert Agent has a documented `data_scope` — the explicit list of fields it can decrypt and read. These are surfaced to you on the hire screen BEFORE you complete Stripe Checkout.

| Expert Agent | data_scope (what this agent can read) |
|---|---|
| **WaveX Optimizer** (`optimizer-v1`) | `kpi_snapshots`, `open_issue_titles`, `fleet_status` |
| **WaveX Alignment** (`alignment-v1`) | `kpi_snapshots`, `kpi_deltas`, `goal`, `monte_carlo_baseline` |
| **WaveX Error Handler** (`error-handler-v1`) | `failed_runs`, `agent_status`, `error_signatures` |
| **WaveX Concierge** (`concierge-v1`) | All of the above PLUS `issue_bodies`, `comments` |

Hiring agent A and agent B grants each agent access ONLY to the fields in its respective scope. Hiring the Optimizer does NOT give the Concierge access to your issue bodies.

The current data_scope for any Expert Agent can be verified at runtime via:

```sql
select id, display_name, data_scope from wavex_os.expert_agent_catalog where is_active = true;
```

We may add new fields to an Expert Agent's data_scope in the future. When we do, we bump the agreement version. Existing hires remain valid under the version you originally accepted; the agent does NOT gain access to new fields until you re-consent.

---

## 3. Retention

- **Fleet digests** are auto-deleted from Supabase 24 hours after upload (`ttl_at` column on `wavex_os.fleet_digests`). A platform cleanup process enforces this.
- **Digest access log** rows are retained indefinitely for your audit purposes. You can request deletion at any time (see Section 7).
- **Injection queue** rows are auto-deleted 72 hours after creation (or upon successful consumption by your Liaison agent, whichever is sooner).
- **Anthropic** retains API inputs for up to 30 days for abuse-detection purposes, then deletes. Anthropic does NOT use API inputs to train models. This is Anthropic's policy, not ours — but it applies to all Pool A and Pool C inference calls.

---

## 4. What we DO NOT do with your data

- We do not train models on your data.
- We do not share your data with third parties other than the sub-processors named in Section 5.
- We do not use your data for advertising, marketing analysis, or sales prospecting.
- We do not allow WaveX engineers to read your fleet_digests except via the per-catalog worker processes (which only decrypt fields scoped to a single agent, with audit trail). The Supabase service-role key cannot decrypt your data on its own.
- We do not aggregate your data with other customers' data. Each subscription's fleet_digest rows are tagged with `subscription_id` and scoped via Postgres Row-Level Security.

---

## 5. Sub-processors

We use the following third-party services in delivering Expert Agent functionality:

| Sub-processor | Role | What it sees |
|---|---|---|
| **Supabase** | Stores `wavex_os.*` tables: fleet_digests (encrypted envelopes only), hired_expert_agents, digest_access_log, injection_queue | Encrypted ciphertext only. Cannot decrypt without per-catalog worker private keys. |
| **Anthropic** | Processes inference calls for each Expert Agent's prompt | The decrypted snippet for the specific Expert Agent that called it. Subject to Anthropic's API Terms (30d retention, no training). |
| **Stripe** | Processes payments | Your billing details (name, email, card). Does NOT see your fleet data. |
| **Cloudflare** | Provides the Tunnel + DDoS protection at `api.wavex-os.com` | TLS-encrypted traffic only (Cloudflare cannot decrypt). |

If we add a sub-processor that handles your fleet data, we bump this Agreement's version and request re-consent.

---

## 6. Security commitments

- Field-level encryption is enforced before data leaves your machine. Plaintext fleet data NEVER exists on WaveX servers.
- Per-catalog worker private keys are stored ONLY in the macOS Keychain of the WaveX operator running `api.wavex-os.com`. They are NOT stored in Supabase secrets, environment variables, source control, or any other location.
- All transit is TLS 1.3.
- Database access is restricted to the per-catalog worker processes and the WaveX operator's admin login (the Meta Mission Control dashboard, which can only see metadata, not decrypted content).
- The Supabase service-role key is restricted to writing audit rows and ciphertext. It cannot decrypt fleet data.
- All commits to the `wavex-os` repo go through a pre-push security audit that scans for hardcoded secrets, project refs, and personal paths.

---

## 7. Your rights

You may at any time, without giving a reason:

1. **Revoke an Expert Agent.** In Mission Control → Privacy Panel → Revoke. Within 1 hour, pending fleet_digest rows targeted at that agent are deleted from Supabase.
2. **Export all data we have about you.** Email <support@wavex-os.com> with subject "Data export request". Within 7 days you receive a JSON dump of every row in `wavex_os.*` tagged with your `subscription_id`.
3. **Delete all data we have about you.** Email <support@wavex-os.com> with subject "Account deletion request". Within 7 days we cancel your subscription, delete all `wavex_os.*` rows associated with your `subscription_id`, and confirm.
4. **Pause processing** without revoking. Set the hired_expert_agents row to `status='paused'` via Mission Control. The worker will not read your digests until you reactivate.

---

## 8. Compelled disclosure

If WaveX or any sub-processor receives a legally compelled disclosure request (subpoena, court order, government inquiry) for data covered by this Agreement, we will:

1. Notify you within 72 hours, unless legally prohibited from doing so.
2. Disclose only the minimum responsive data.
3. Challenge requests we believe are overbroad or improper.

Anthropic's compelled-disclosure handling is governed by their own policy. If Anthropic discloses inference inputs (which, per their retention policy, exist for ≤30 days), the decrypted snippets sent during that window are in scope.

---

## 9. Term and termination

- This Agreement begins when you first hire an Expert Agent and continues until you revoke ALL hired Expert Agents OR cancel your subscription.
- We may terminate by giving you 30 days written notice. You may terminate at any time without notice. Upon termination of any kind, Section 7 (your rights) applies.
- Sections 3 (Retention), 4 (Do-Not), and 6 (Security commitments) survive termination with respect to any data we still hold for audit purposes.

---

## 10. Governing law, dispute resolution

This Agreement is governed by the laws of [JURISDICTION TBD — placeholder until incorporation is finalized]. Disputes shall be resolved by binding arbitration in [VENUE TBD].

---

## 11. Updates to this Agreement

When we change this Agreement, we increment the version (e.g. 1.0 → 1.1). Existing hires remain valid under the version you originally accepted. New material changes that expand an Expert Agent's data_scope or sub-processor list require re-consent — you will be prompted on your next Mission Control visit. Cosmetic changes (typo fixes, link updates) do NOT require re-consent.

---

## 12. Contact

- **Support:** <support@wavex-os.com>
- **Security disclosures:** <security@wavex-os.com>
- **Legal:** <legal@wavex-os.com>
- **GitHub issue tracker** (for non-sensitive product questions): <https://github.com/aimerdoux/wavex-os/issues>

---

*This Agreement is the entire agreement between you and WaveX with respect to the data flows enabled by hiring an Expert Agent. It supplements, but does not replace, the [WaveX OS Open Source Privacy Notice](./OPEN_SOURCE_NOTICE.md), which continues to govern your free-tier usage of WaveX OS.*
