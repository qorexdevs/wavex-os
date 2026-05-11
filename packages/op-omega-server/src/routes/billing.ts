/**
 * Local billing routes — proxy to Supabase + Stripe edge functions.
 *
 * Mounted under /api/billing/* by mock-core. These run in the customer's
 * own machine and talk to api.wavex-os.com (Supabase) over HTTPS.
 *
 * Routes:
 *   GET  /api/billing/subscription              — current local subscription state
 *   GET  /api/billing/subscription/by-checkout/:sid — used by Pricing page polling
 *   POST /api/billing/subscription/sync          — pull latest from Supabase, write local
 *   POST /api/billing/subscription/cancel        — proxy to Stripe portal
 *   DELETE /api/billing/subscription              — local wipe (after confirmed cancel)
 */
import type { FastifyInstance } from "fastify";
import {
  readLocalSubscription,
  writeLocalSubscription,
  deleteLocalSubscription,
  isActive,
  type SubscriptionFile,
} from "../billing/subscription-store.js";

// Operators set these in their local .env. No defaults — downstream forks
// must point at their OWN Supabase project, not whatever was here when
// this code was written.
const SUPABASE_URL = process.env.WAVEX_SUPABASE_URL ?? "";
const SUPABASE_ANON = process.env.WAVEX_SUPABASE_ANON_KEY ?? "";

export async function registerBillingRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/billing/subscription", async (_req, reply) => {
    const sub = await readLocalSubscription();
    if (!sub) {
      return reply.code(404).send({ error: "no_subscription" });
    }
    return reply.send({
      tier: sub.tier,
      status: sub.status,
      active: isActive(sub),
      current_period_end: sub.current_period_end,
      last_refreshed_at: sub.last_refreshed_at,
    });
  });

  // Used by /pricing success-callback polling. Looks up a Supabase row by
  // Stripe checkout session id (via the stripe-webhook event payload).
  app.get<{ Params: { sid: string } }>(
    "/api/billing/subscription/by-checkout/:sid",
    async (req, reply) => {
      if (!SUPABASE_ANON || !SUPABASE_URL) {
        return reply.code(503).send({ error: "supabase_not_configured" });
      }
      const sid = req.params.sid;
      const url = `${SUPABASE_URL}/rest/v1/rpc/wavex_os_subscription_by_checkout`;
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON,
          "Authorization": `Bearer ${SUPABASE_ANON}`,
        },
        body: JSON.stringify({ checkout_session_id: sid }),
      });
      if (!r.ok) return reply.code(404).send({ error: "not_found" });
      const body = (await r.json()) as unknown as SubscriptionFile | null;
      if (!body) return reply.code(404).send({ error: "not_found" });

      // Persist locally so subsequent boots see active state immediately.
      await writeLocalSubscription({
        v: 1,
        user_id: body.user_id,
        subscription_id: body.subscription_id,
        tier: body.tier,
        status: body.status,
        current_period_end: body.current_period_end,
        jwt: body.jwt,
        jwt_expires_at: body.jwt_expires_at,
        last_refreshed_at: new Date().toISOString(),
      });

      return reply.send({
        tier: body.tier,
        status: body.status,
        active: isActive(body),
      });
    },
  );

  app.post("/api/billing/subscription/sync", async (_req, reply) => {
    const local = await readLocalSubscription();
    if (!local) {
      return reply.code(404).send({ error: "no_local_subscription" });
    }
    // TODO F.1.b: hit api.wavex-os.com/billing/sync with JWT, refresh local.
    // Stubbed for F.1 — the webhook is the authoritative path; sync is
    // only needed for offline-recovery scenarios. Returning current local
    // state for now.
    return reply.send({
      tier: local.tier,
      status: local.status,
      active: isActive(local),
      synced: false,
      note: "F.1 stub — webhook is authoritative",
    });
  });

  app.delete("/api/billing/subscription", async (_req, reply) => {
    await deleteLocalSubscription();
    return reply.send({ ok: true });
  });
}
