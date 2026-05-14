/**
 * Client for the `os-inference` edge function.
 *
 * Routes a customer's T2 calls through the Console (which proxies to
 * Lovable AI Gateway / Anthropic) when their subscription tier permits.
 * Quota accounting happens on the cloud side via the `os_usage` table.
 *
 * The local inference-server's existing `oauth` backend (operator's own
 * Claude Max) handles FREE-tier Pool A. This client is invoked for PAID
 * tiers where the operator wants billing to flow through their cloud
 * subscription, not their personal keychain.
 *
 * Future tier-router responsibility (not yet wired):
 *   tier === "free" || !devicePaired   → local Pool A (oauth keychain)
 *   tier ∈ {founder, growth, custom}   → call cloudInference()
 */
import { getValidAccessToken } from "./token-store.js";
import { loadConfig, fnUrl, type CloudConfig } from "./config.js";

export interface CloudInferenceRequest {
  prompt: string;
  model?: string;
  max_output_tokens?: number;
  /** Optional purpose tag for the cloud-side usage ledger. */
  purpose?: string;
}

export interface CloudInferenceResponse {
  ok: true;
  content: string;
  model: string;
  request_id: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  /** From the cloud quota accounting. */
  quota: {
    tokens_used_this_period: number;
    tokens_remaining_this_period: number;
    period_resets_at: number;
  };
}

export interface CloudInferenceError {
  ok: false;
  error:
    | "no_paired_device"
    | "quota_exceeded"
    | "tier_not_eligible"
    | "subscription_expired"
    | "rate_limited"
    | "upstream_error"
    | "internal";
  message: string;
  /** When quota_exceeded: deep link to Stripe checkout / upgrade flow. */
  upgrade_url?: string;
  /** When rate_limited: seconds to wait before retry. */
  retry_after?: number;
}

/**
 * Call os-inference. Returns a discriminated union; ok=true means the
 * response body is in `content`. Never throws on HTTP failures from the
 * cloud — those return `{ ok: false, error: "..." }`. Throws only on
 * network failures + the "no paired device" case (so callers can prompt
 * the user to run `wavex-os login`).
 */
export async function cloudInference(
  req: CloudInferenceRequest,
  cfg?: CloudConfig,
): Promise<CloudInferenceResponse | CloudInferenceError> {
  const c = cfg ?? loadConfig();
  const token = await getValidAccessToken(c); // throws no_paired_device if missing

  const url = fnUrl(c, "os-inference");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), c.timeoutMs);
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
    if (c.publicKey) headers["apikey"] = c.publicKey;

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        prompt: req.prompt,
        model: req.model,
        max_output_tokens: req.max_output_tokens,
        purpose: req.purpose,
      }),
      signal: controller.signal,
    });

    // Cloud convention: even 4xx-class business errors return a JSON
    // body the client can switch on. Only true network/timeout failures
    // bubble up as thrown exceptions.
    const body = (await res.json().catch(() => null)) as
      | CloudInferenceResponse
      | CloudInferenceError
      | null;

    if (!body) {
      return {
        ok: false,
        error: "internal",
        message: `os-inference returned HTTP ${res.status} with no parseable body`,
      };
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}
