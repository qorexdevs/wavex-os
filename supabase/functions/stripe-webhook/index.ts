/**
 * Stripe webhook → wavex_os.subscriptions
 *
 * Handles the minimum events needed for subscription lifecycle:
 *   - checkout.session.completed         → first-time signup, write subscription
 *   - customer.subscription.created      → backup path (sometimes fires before checkout completes)
 *   - customer.subscription.updated      → renewal, upgrade, cancel-at-period-end
 *   - customer.subscription.deleted      → end of subscription
 *   - invoice.paid                       → period rollover
 *   - invoice.payment_failed             → status -> past_due
 *
 * Deploy:
 *   supabase functions deploy stripe-webhook --no-verify-jwt
 *
 * Env vars required:
 *   STRIPE_SECRET_KEY              — sk_test_... or sk_live_...
 *   STRIPE_WEBHOOK_SECRET          — from `stripe listen` or dashboard webhook
 *   SUPABASE_URL                   — auto-injected
 *   SUPABASE_SERVICE_ROLE_KEY      — auto-injected
 *
 * Configure in Stripe dashboard:
 *   Endpoint: https://<project-ref>.supabase.co/functions/v1/stripe-webhook
 *   Events: checkout.session.completed, customer.subscription.*, invoice.paid,
 *           invoice.payment_failed
 */
// @ts-expect-error — Deno-style import resolved at runtime in Supabase Edge
import Stripe from "https://esm.sh/stripe@17.5.0?target=denonext";
// @ts-expect-error — Deno-style import
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.1";

const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!;
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const stripe = new Stripe(stripeKey, {
  apiVersion: "2025-09-30.clover" as Stripe.StripeConfig["apiVersion"],
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();

const sb = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type SubRow = {
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  tier: "founder" | "growth" | "custom";
  status: string;
  current_period_start: string;
  current_period_end: string;
  trial_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  metadata: Record<string, unknown>;
};

function isoFromUnix(s: number | null | undefined): string | null {
  return s ? new Date(s * 1000).toISOString() : null;
}

function tierFromPriceLookupKey(key: string | null): SubRow["tier"] | null {
  switch (key) {
    case "wavex_os_founder": return "founder";
    case "wavex_os_growth":  return "growth";
    case "wavex_os_custom":  return "custom";
    default: return null;
  }
}

async function upsertSubscriptionFromStripe(
  stripeSub: Stripe.Subscription,
  userId: string | null,
): Promise<void> {
  // Resolve user_id either from passed value (checkout session metadata) or
  // by looking up an existing row by stripe_customer_id.
  let resolvedUserId = userId;
  if (!resolvedUserId) {
    const { data: prior } = await sb
      .schema("wavex_os")
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_subscription_id", stripeSub.id)
      .maybeSingle();
    resolvedUserId = (prior as { user_id?: string } | null)?.user_id ?? null;
  }
  if (!resolvedUserId) {
    console.error(`No user_id for subscription ${stripeSub.id} — skipping`);
    return;
  }

  // Pull lookup_key from the subscription's first item's price.
  const item = stripeSub.items.data[0];
  const lookupKey = item?.price?.lookup_key ?? null;
  const tier = tierFromPriceLookupKey(lookupKey);
  if (!tier) {
    console.error(`Unknown price lookup_key ${lookupKey} on sub ${stripeSub.id}`);
    return;
  }

  const row: SubRow = {
    user_id: resolvedUserId,
    stripe_customer_id:
      typeof stripeSub.customer === "string" ? stripeSub.customer : stripeSub.customer.id,
    stripe_subscription_id: stripeSub.id,
    tier,
    status: stripeSub.status,
    current_period_start: isoFromUnix((stripeSub as unknown as { current_period_start: number }).current_period_start)!,
    current_period_end: isoFromUnix((stripeSub as unknown as { current_period_end: number }).current_period_end)!,
    trial_end: isoFromUnix(stripeSub.trial_end ?? null),
    cancel_at_period_end: stripeSub.cancel_at_period_end,
    canceled_at: isoFromUnix(stripeSub.canceled_at ?? null),
    metadata: stripeSub.metadata as Record<string, unknown>,
  };

  const { error } = await sb
    .schema("wavex_os")
    .from("subscriptions")
    .upsert(row, { onConflict: "stripe_subscription_id" });

  if (error) {
    console.error("upsert subscriptions failed", error);
    throw error;
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const subscriptionId = typeof session.subscription === "string"
    ? session.subscription
    : session.subscription?.id;
  if (!subscriptionId) return;

  // user_id MUST be passed in client_reference_id or metadata.user_id by the pricing page.
  const userId =
    session.client_reference_id ??
    (session.metadata?.user_id as string | undefined) ??
    null;

  // Re-fetch the subscription to get price + period info.
  const sub = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  });
  await upsertSubscriptionFromStripe(sub, userId);
}

async function handleSubscriptionEvent(stripeSub: Stripe.Subscription): Promise<void> {
  await upsertSubscriptionFromStripe(stripeSub, null);
}

async function handleSubscriptionDeleted(stripeSub: Stripe.Subscription): Promise<void> {
  const { error } = await sb
    .schema("wavex_os")
    .from("subscriptions")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
      cancel_at_period_end: stripeSub.cancel_at_period_end,
    })
    .eq("stripe_subscription_id", stripeSub.id);
  if (error) {
    console.error("mark canceled failed", error);
    throw error;
  }
}

async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const subId = typeof (invoice as unknown as { subscription: string | null }).subscription === "string"
    ? (invoice as unknown as { subscription: string }).subscription
    : null;
  if (!subId) return;
  const sub = await stripe.subscriptions.retrieve(subId);
  await upsertSubscriptionFromStripe(sub, null);
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const subId = typeof (invoice as unknown as { subscription: string | null }).subscription === "string"
    ? (invoice as unknown as { subscription: string }).subscription
    : null;
  if (!subId) return;
  await sb
    .schema("wavex_os")
    .from("subscriptions")
    .update({ status: "past_due" })
    .eq("stripe_subscription_id", subId);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret, undefined, cryptoProvider);
  } catch (err) {
    console.error("signature verification failed", err);
    return new Response(`Webhook Error: ${(err as Error).message}`, { status: 400 });
  }

  // Idempotency: skip if already processed.
  const { error: idemErr } = await sb
    .schema("wavex_os")
    .from("stripe_webhook_events")
    .insert({
      id: event.id,
      type: event.type,
      api_version: event.api_version,
      payload: event as unknown as Record<string, unknown>,
    });

  if (idemErr && idemErr.code === "23505") {
    // Duplicate event id — already processed.
    return new Response(JSON.stringify({ ok: true, duplicate: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }
  if (idemErr) {
    console.error("idempotency insert failed", idemErr);
    return new Response("Internal error", { status: 500 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionEvent(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        // unhandled — fine, idempotency row still recorded
        break;
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    // Record processing error against the idempotency row for forensics.
    await sb
      .schema("wavex_os")
      .from("stripe_webhook_events")
      .update({ processing_error: (err as Error).message })
      .eq("id", event.id);
    console.error("event handler failed", err);
    return new Response("Handler error", { status: 500 });
  }
});
