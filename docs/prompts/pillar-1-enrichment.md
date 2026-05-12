# Pillar 1 — operator-input enrichment

**Purpose:** Given the operator's raw company description (≤200 words) plus optional URL, infer the 10 structured Pillar-1 fields the wizard needs to drive Phase 2/3 decision matrices.

**Caller:** `vendor/op-omega/onboarding/src/phases/phase-1-pillar/enrichment.ts`

**Pool:** A — WaveX-paid, anonymous, rate-limited via the inference-server.

**Model:** Sonnet 4.6 with `extended_thinking=false`. T2 enrichment is structured-output extraction, not creative writing — Sonnet is sufficient and faster than Opus. ~3-5K input tokens, ~1.5K output tokens per call.

## Inputs

| Variable | Description | Source |
|---|---|---|
| `{{ORG_NAME}}` | Company name (operator-supplied) | Pillar 1 form |
| `{{RAW_INPUT}}` | Free-text description from operator | Pillar 1 form |
| `{{URL}}` | Optional URL of company website | Pillar 1 form |
| `{{URL_CONTENT}}` | Fetched HTML→markdown if URL provided; empty otherwise | server-side `fetch` |

## Output schema

```jsonc
{
  "company_context": "string (≤300 chars, prose summary)",
  "industry_hint": "string (one of: saas|ecommerce|services|content|hardware|fintech|healthtech|edtech|marketplace|infra|other)",
  "business_model_hint": "string (b2b_saas|b2c_subscription|marketplace|ad_supported|transactional|services_hourly|services_retainer|enterprise_license|hybrid|unknown)",
  "ideal_customer_profile": "string (≤200 chars)",
  "revenue_model": "string",
  "competitive_position": "string (one of: leader|fast_follower|niche|unvalidated)",
  "primary_acquisition_channel": "string (outbound|inbound_content|paid_ads|referral|community|partnerships|other)",
  "product_maturity_signal": "string (pre_mvp|mvp|product_market_fit|scaling|mature)",
  "tone_signal": "string (technical|friendly|formal|playful|serious)",
  "primary_friction_hypothesis": "string (≤200 chars)",
  "differentiator_hypothesis": "string (≤200 chars)"
}
```

## Prompt body

```
You are enriching a Pillar 1 onboarding response for WaveX OS. The operator
has provided minimal information about their company. Your job is to infer
10 structured fields that downstream decision matrices need.

Operator-supplied data:

- Org name: {{ORG_NAME}}
- Description: {{RAW_INPUT}}
- URL: {{URL}}
- URL content (if available):
  {{URL_CONTENT}}

Inference rules:

1. NEVER hallucinate revenue numbers, customer names, or growth metrics. If
   the operator hasn't stated something, infer the structural shape only.
2. If the operator says "pre-product" or "no product yet": industry_hint
   defaults to "other" unless URL content suggests otherwise.
   business_model_hint = "unknown". product_maturity_signal = "pre_mvp".
   competitive_position = "unvalidated".
3. If URL is provided but URL_CONTENT is empty: do not claim to have read
   the site. Treat URL as a domain hint only (e.g. .com vs .ai vs .dev).
4. tone_signal infers from the operator's writing style in RAW_INPUT, not
   from the company's website.
5. primary_friction_hypothesis should answer "what's the biggest single
   thing standing between this company and 10× growth?" — answer in one
   crisp sentence, not bullets. If pre-product, the friction is always
   "going from idea to first paying customer". Do not invent specifics.

Return ONLY the JSON object. No prose, no explanation, no markdown fences.
```

## Failure mode + fallback

If the LLM call returns invalid JSON, returns 5xx, or times out at 60s, the wizard falls back to a deterministic T1 enrichment:

- All `_hint` fields default to `"unknown"`
- `company_context` set to `RAW_INPUT` truncated to 300 chars
- `competitive_position = "unvalidated"`
- `product_maturity_signal = "pre_mvp"` if RAW_INPUT contains any of `["pre-product", "no product", "haven't shipped", "idea stage"]`, else `"mvp"`
- `tone_signal = "friendly"`
- `primary_friction_hypothesis = "operator has not yet articulated their bottleneck"`
- `differentiator_hypothesis = "operator has not yet articulated a differentiator"`

The wizard shows the operator a non-blocking notice: "AI enrichment unavailable — using deterministic mode. You can re-run from Mission Control once the inference service is reachable."

This fallback is the critical reliability property from V2_CAPTURE_C §5 — onboarding must succeed even when the WaveX inference server is unreachable.

## Test fixtures

Located at `vendor/op-omega/onboarding/test/differential-equation-suite/fixtures/`:
- `acme-b2b-saas-outbound.json` — happy path B2B SaaS
- `acme-plg-startup.json` — PLG variant
- `acme-no-product.json` — pre-product fallback case
- `contradictory.json` — operator description contradicts URL content (should resolve to URL content)
- `minimal-comms.json` — operator gives ~10 words only
- `unicode-injection.json` — emoji + RTL chars in ORG_NAME

The prompt should produce stable output across these 6 fixtures within ±5% (measured by the differential-equation-suite scorer).
