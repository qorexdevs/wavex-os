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
 *   supabase functions deploy wavex-os-subscription-webhook --no-verify-jwt
 *
 * Env vars required (READ wavex-os-prefixed names FIRST so this function
 * does NOT compete with wavexcard's separate `stripe-webhook` function
 * which uses the unprefixed STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET):
 *   STRIPE_SECRET_KEY_TEST_ENV        — sk_test_... for the staging run; falls back to STRIPE_SECRET_KEY
 *   WAVEX_OS_STRIPE_WEBHOOK_SECRET    — Stripe-issued signing secret for THIS endpoint
 *                                       (different from wavexcard's STRIPE_WEBHOOK_SECRET)
 *   SUPABASE_URL                      — auto-injected
 *   SUPABASE_SERVICE_ROLE_KEY         — auto-injected
 *
 * Configure in Stripe dashboard:
 *   Endpoint: https://<project-ref>.supabase.co/functions/v1/wavex-os-subscription-webhook
 *   Events: checkout.session.completed, customer.subscription.*, invoice.paid,
 *           invoice.payment_failed
 */
// @ts-expect-error — Deno-style import resolved at runtime in Supabase Edge
import Stripe from "https://esm.sh/stripe@17.5.0?target=denonext";
// @ts-expect-error — Deno-style import
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.1";

const stripeKey =
  Deno.env.get("STRIPE_SECRET_KEY_TEST_ENV") ?? Deno.env.get("STRIPE_SECRET_KEY")!;
const webhookSecret =
  Deno.env.get("WAVEX_OS_STRIPE_WEBHOOK_SECRET") ?? Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
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
  // Accept both the original lookup_key naming and the metadata.tier values
  // emitted by internal-setup-wavex-stripe (founder/growth/custom).
  switch (key) {
    case "wavex_os_founder":
    case "founder":
      return "founder";
    case "wavex_os_growth":
    case "growth":
      return "growth";
    case "wavex_os_custom":
    case "custom":
      return "custom";
    default:
      return null;
  }
}

async function upsertSubscriptionFromStripe(
  stripeSub: Stripe.Subscription,
  userId: string | null,
): Promise<void> {
  // Resolve tier from lookup_key OR price.metadata.tier (the setup function
  // populates the latter; lookup_key is a stable Stripe-side convention).
  const item = stripeSub.items.data[0];
  const lookupKey = item?.price?.lookup_key ?? null;
  const metadataTier = (item?.price?.metadata?.tier as string | undefined) ?? null;
  const tier = tierFromPriceLookupKey(lookupKey) ?? tierFromPriceLookupKey(metadataTier);
  if (!tier) {
    console.error(`Unknown tier (lookup_key=${lookupKey}, metadata.tier=${metadataTier}) on sub ${stripeSub.id}`);
    return;
  }

  // Stripe 2025-09 API moved `current_period_*` from the subscription root
  // onto each line item. Read root first (older subs), fall back to items[0].
  // For trialing subs the event payload sometimes lacks both — fall back to
  // trial_start/trial_end (the effective billing period during trial).
  // Last resort: re-fetch from Stripe (handles transient race conditions on
  // customer.subscription.created where the in-event payload hasn't fully
  // hydrated yet — see evt_1TWf673IuKBdXit2rxPmeQAw which failed this way).
  const subAny = stripeSub as unknown as {
    current_period_start?: number;
    current_period_end?: number;
    trial_start?: number;
    trial_end?: number;
    start_date?: number;
  };
  const itemAny = item as unknown as {
    current_period_start?: number;
    current_period_end?: number;
  };
  let periodStart =
    subAny.current_period_start ?? itemAny?.current_period_start ?? null;
  let periodEnd =
    subAny.current_period_end ?? itemAny?.current_period_end ?? null;

  if ((!periodStart || !periodEnd) && stripeSub.status === "trialing"
      && subAny.trial_start && subAny.trial_end) {
    periodStart = periodStart ?? subAny.trial_start;
    periodEnd = periodEnd ?? subAny.trial_end;
  }

  if (!periodStart || !periodEnd) {
    // Last-chance: re-fetch with item expansion. Costs a round-trip but only
    // happens on degenerate event payloads. Failing here means Stripe state
    // really is incomplete; we log + bail rather than INSERT null.
    try {
      const fresh = await stripe.subscriptions.retrieve(stripeSub.id, {
        expand: ["items.data.price"],
      });
      const freshAny = fresh as unknown as {
        current_period_start?: number; current_period_end?: number;
        trial_start?: number; trial_end?: number;
      };
      const freshItemAny = fresh.items.data[0] as unknown as {
        current_period_start?: number; current_period_end?: number;
      };
      periodStart = periodStart
        ?? freshAny.current_period_start
        ?? freshItemAny?.current_period_start
        ?? (fresh.status === "trialing" ? freshAny.trial_start : undefined)
        ?? null;
      periodEnd = periodEnd
        ?? freshAny.current_period_end
        ?? freshItemAny?.current_period_end
        ?? (fresh.status === "trialing" ? freshAny.trial_end : undefined)
        ?? null;
    } catch (refetchErr) {
      console.error(`Re-fetch failed for ${stripeSub.id}`, refetchErr);
    }
  }

  if (!periodStart || !periodEnd) {
    console.error(`No current_period_* (root, items[0], trial_*, or re-fetched) on sub ${stripeSub.id} status=${stripeSub.status} — skipping`);
    return;
  }

  // RPC handles user_id resolution + upsert in one round-trip. Pass null
  // user_id and the RPC will look up the prior row by stripe_subscription_id.
  const { data, error } = await sb.rpc("wavex_os_subscription_upsert", {
    p_user_id: userId,
    p_stripe_customer_id:
      typeof stripeSub.customer === "string" ? stripeSub.customer : stripeSub.customer.id,
    p_stripe_subscription_id: stripeSub.id,
    p_tier: tier,
    p_status: stripeSub.status,
    p_current_period_start: isoFromUnix(periodStart),
    p_current_period_end: isoFromUnix(periodEnd),
    p_trial_end: isoFromUnix(stripeSub.trial_end ?? null),
    p_cancel_at_period_end: stripeSub.cancel_at_period_end ?? false,
    p_canceled_at: isoFromUnix(stripeSub.canceled_at ?? null),
    p_metadata: stripeSub.metadata ?? {},
  });
  if (error) {
    console.error("wavex_os_subscription_upsert failed", error);
    throw error;
  }
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  if (rows.length === 0) {
    console.error(`Upsert returned no row for sub ${stripeSub.id} — no user_id link could be resolved`);
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
  const { error } = await sb.rpc("wavex_os_subscription_mark_canceled", {
    p_stripe_subscription_id: stripeSub.id,
    p_canceled_at: new Date().toISOString(),
    p_cancel_at_period_end: stripeSub.cancel_at_period_end ?? false,
  });
  if (error) {
    console.error("wavex_os_subscription_mark_canceled failed", error);
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
  const { error } = await sb.rpc("wavex_os_subscription_mark_past_due", {
    p_stripe_subscription_id: subId,
  });
  if (error) console.error("wavex_os_subscription_mark_past_due failed", error);
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
  const { data: idemData, error: idemErr } = await sb.rpc("wavex_os_record_webhook_event", {
    p_id: event.id,
    p_type: event.type,
    p_api_version: event.api_version,
    p_payload: event as unknown as Record<string, unknown>,
  });
  if (idemErr) {
    console.error("idempotency insert failed", idemErr);
    return new Response("Internal error", { status: 500 });
  }
  const isDup = Array.isArray(idemData) ? idemData[0]?.is_duplicate : idemData?.is_duplicate;
  if (isDup) {
    return new Response(JSON.stringify({ ok: true, duplicate: true }), {
      headers: { "Content-Type": "application/json" },
    });
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
    await sb.rpc("wavex_os_mark_webhook_event_error", {
      p_id: event.id,
      p_error: (err as Error).message,
    });
    console.error("event handler failed", err);
    return new Response("Handler error", { status: 500 });
  }
});
