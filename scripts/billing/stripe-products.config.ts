/**
 * WaveX OS Phase F billing — Stripe product + price definitions.
 *
 * Source of truth. Use scripts/billing/setup-stripe.ts to apply these
 * against your Stripe account (creates products + prices if missing,
 * idempotent on lookup_key).
 *
 * Pricing rationale: see docs/PHASE_F_SETUP.md "Pricing economics".
 * - Founder $29/mo  → ~$0.50/day Pool C burn limit, ~55% gross margin
 * - Growth  $99/mo  → ~$3/day Pool C burn limit, ~55% gross margin
 * - Custom $299/mo  → unlimited (rate-limited at 100 injections/day server-side)
 */

export interface StripeProductSpec {
  /** Stable lookup key — never change after launch. Used for idempotent setup. */
  lookupKey: "wavex_os_founder" | "wavex_os_growth" | "wavex_os_custom";
  name: string;
  description: string;
  /** Tier mapped to wavex_os.subscriptions.tier */
  tier: "founder" | "growth" | "custom";
  /** USD price in cents, monthly recurring */
  unitAmountCents: number;
  /** Trial in days */
  trialDays: number;
  /** Metadata attached to Stripe Product (informational) */
  metadata: Record<string, string>;
}

export const STRIPE_PRODUCTS: StripeProductSpec[] = [
  {
    lookupKey: "wavex_os_founder",
    name: "WaveX OS — Founder",
    description:
      "1 daily board-level injection from your WaveX-hosted optimizer. 500K Pool C tokens / month. Error concierge: none.",
    tier: "founder",
    unitAmountCents: 2900,
    trialDays: 14,
    metadata: {
      tier: "founder",
      injection_cadence: "daily",
      monthly_token_cap: "500000",
      error_concierge: "false",
      alignment_correction: "false",
    },
  },
  {
    lookupKey: "wavex_os_growth",
    name: "WaveX OS — Growth",
    description:
      "Hourly injections during business hours. 2M Pool C tokens / month. Error concierge enabled. Alignment correction on KPI deviation.",
    tier: "growth",
    unitAmountCents: 9900,
    trialDays: 14,
    metadata: {
      tier: "growth",
      injection_cadence: "hourly_business_hours",
      monthly_token_cap: "2000000",
      error_concierge: "true",
      alignment_correction: "true",
      ondemand_asks_per_day: "5",
    },
  },
  {
    lookupKey: "wavex_os_custom",
    name: "WaveX OS — Custom",
    description:
      "Continuous (5min) injections, dedicated optimizer thread, human-in-the-loop concierge. 100 injections/day hard cap. Best for businesses where the local fleet is mission-critical.",
    tier: "custom",
    unitAmountCents: 29900,
    trialDays: 14,
    metadata: {
      tier: "custom",
      injection_cadence: "continuous",
      monthly_token_cap: "unlimited",
      daily_injection_cap: "100",
      error_concierge: "true",
      alignment_correction: "true",
      human_concierge: "true",
      ondemand_asks_per_day: "unlimited",
    },
  },
];
