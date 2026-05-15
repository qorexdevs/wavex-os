/**
 * Client for the `os-spend-intent` edge function.
 *
 * Local agents NEVER call this directly — the Liaison agent observes
 * `spend_request`-labeled issues in Paperclip, validates the request
 * against the local manifest + policy, then proxies through this
 * client. That single-entry-point pattern keeps the spend authority
 * auditable (every cloud spend has a corresponding Paperclip issue) and
 * prevents fleet agents from impersonating each other.
 *
 * The cloud side then performs:
 *   1. Device JWT verification
 *   2. Subscription tier check (does this tier permit this kind?)
 *   3. Wallet balance check (USDC/USDT only — per memory rule)
 *   4. Device policy check (daily cap, allowed kinds, whitelist)
 *   5. If all green → execute via Bridge / Stripe / process-payment
 *      If above cap or unknown recipient → push to console "Pending
 *      approvals" + WhatsApp/email, return `{ ok: true, status: "pending" }`.
 */
import { getValidAccessToken } from "./token-store.js";
import { loadConfig, hubUrl, type CloudConfig } from "./config.js";

export type SpendKind =
  | "subscription"     // pay a SaaS recurring fee
  | "issue_card"       // provision a Bridge prepaid debit card
  | "send_bank"        // ACH / wire transfer
  | "topup_wallet";    // move stablecoin into the agent wallet

export interface SpendIntentRequest {
  /** What type of spend the agent wants to perform. */
  kind: SpendKind;
  /** Amount in USD cents. Cloud side enforces the device's daily cap. */
  amount_cents: number;
  /** Free-text recipient identifier — vendor name, IBAN tag, etc. */
  recipient: string;
  /** Why the agent wants to do this. Surfaces in console "Pending" UI. */
  reason: string;
  /** Optional Paperclip issue ID this spend traces back to. */
  source_issue_id?: string;
  /** Idempotency key — server dedupes by this when retried. */
  idempotency_key: string;
}

export interface SpendIntentApproved {
  ok: true;
  status: "approved" | "executed";
  /** Server-side intent record id (for ledger lookup). */
  intent_id: string;
  /** Present when status="executed". */
  receipt?: {
    rail: "stripe" | "bridge_card" | "bridge_ach" | "wallet_topup";
    external_id: string;
    executed_at: number;
  };
}

export interface SpendIntentPending {
  ok: true;
  status: "pending_approval";
  intent_id: string;
  /** Where the user goes to approve (console URL deep-link). */
  approval_url: string;
  /** Reason it needed manual approval — "above_cap" | "unknown_recipient" | "policy_match" */
  reason_code: string;
}

export interface SpendIntentError {
  ok: false;
  error:
    | "no_paired_device"
    | "tier_not_eligible"
    | "insufficient_balance"
    | "policy_denied"
    | "kind_not_permitted"
    | "asset_not_allowed"
    | "subscription_expired"
    | "rate_limited"
    | "upstream_error"
    | "internal";
  message: string;
  /** When tier_not_eligible / kind_not_permitted: upgrade deep-link. */
  upgrade_url?: string;
  retry_after?: number;
}

export type SpendIntentResult =
  | SpendIntentApproved
  | SpendIntentPending
  | SpendIntentError;

/**
 * POST to os-spend-intent with the device JWT.
 *
 * Never throws on cloud-side business errors — those return
 * `{ ok: false, error: "..." }`. Throws only on missing device pairing
 * + network failures.
 */
export async function submitSpendIntent(
  req: SpendIntentRequest,
  cfg?: CloudConfig,
): Promise<SpendIntentResult> {
  const c = cfg ?? loadConfig();
  const token = await getValidAccessToken(c);

  // Hits the inference-server directly via the Cloudflare Tunnel. The
  // hub verifies the device JWT then routes the intent through the
  // policy/bridge stack (stub until the execution path lands).
  const url = hubUrl(c, "/v1/os/spend-intent");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), c.timeoutMs);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "Idempotency-Key": req.idempotency_key,
    };

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        kind: req.kind,
        amount_cents: req.amount_cents,
        recipient: req.recipient,
        reason: req.reason,
        source_issue_id: req.source_issue_id,
        idempotency_key: req.idempotency_key,
      }),
      signal: controller.signal,
    });

    const body = (await res.json().catch(() => null)) as SpendIntentResult | null;
    if (!body) {
      return {
        ok: false,
        error: "internal",
        message: `/v1/os/spend-intent returned HTTP ${res.status} with no parseable body`,
      };
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}
