/**
 * Idempotent Stripe product + price setup.
 *
 * Run once per environment (test / live):
 *   STRIPE_SECRET_KEY=sk_test_... pnpm tsx scripts/billing/setup-stripe.ts
 *
 * Behavior:
 *   1. For each product in STRIPE_PRODUCTS, look up by lookup_key (on prices).
 *   2. If product+price exists → no-op, print the existing IDs.
 *   3. If missing → create Product + monthly recurring Price with the
 *      lookup_key. Trial is applied per-checkout-session, not on the price.
 *   4. Print a `.env`-style block at the end so you can paste the price IDs
 *      into your `onboarding-ui/.env`.
 *
 * Safe to re-run. Will NOT modify existing prices (Stripe doesn't allow
 * editing amount — to change price, archive old + create new).
 */
import Stripe from "stripe";
import { STRIPE_PRODUCTS } from "./stripe-products.config.js";

const apiKey = process.env.STRIPE_SECRET_KEY;
if (!apiKey) {
  console.error("STRIPE_SECRET_KEY env var required");
  process.exit(1);
}

const stripe = new Stripe(apiKey);

async function ensureProductAndPrice(
  spec: (typeof STRIPE_PRODUCTS)[number],
): Promise<{ productId: string; priceId: string; created: boolean }> {
  // Look up by lookup_key on prices — that's the documented idempotency surface.
  const existing = await stripe.prices.list({
    lookup_keys: [spec.lookupKey],
    expand: ["data.product"],
    active: true,
  });

  if (existing.data.length > 0) {
    const price = existing.data[0]!;
    const productId =
      typeof price.product === "string" ? price.product : price.product.id;
    return { productId, priceId: price.id, created: false };
  }

  const product = await stripe.products.create({
    name: spec.name,
    description: spec.description,
    metadata: spec.metadata,
  });

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: spec.unitAmountCents,
    currency: "usd",
    recurring: { interval: "month" },
    lookup_key: spec.lookupKey,
    metadata: { tier: spec.tier, trial_days: String(spec.trialDays) },
  });

  return { productId: product.id, priceId: price.id, created: true };
}

async function main(): Promise<void> {
  console.log("Setting up Stripe products + prices…");
  const out: Record<string, { productId: string; priceId: string; created: boolean; spec: typeof STRIPE_PRODUCTS[number] }> = {};

  for (const spec of STRIPE_PRODUCTS) {
    const r = await ensureProductAndPrice(spec);
    out[spec.lookupKey] = { ...r, spec };
    const mark = r.created ? "  CREATED" : "  exists ";
    console.log(`${mark}  ${spec.lookupKey.padEnd(20)}  $${(spec.unitAmountCents / 100).toFixed(2)}/mo  trial:${spec.trialDays}d  price=${r.priceId}`);
  }

  console.log("\n# Paste into onboarding-ui/.env (or .env.local):");
  for (const [key, r] of Object.entries(out)) {
    const env = key.toUpperCase().replace(/^WAVEX_OS_/, "VITE_STRIPE_PRICE_");
    console.log(`${env}=${r.priceId}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
