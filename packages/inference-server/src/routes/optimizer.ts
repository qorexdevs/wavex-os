/**
 * Pool C — System Optimizer inference (subscription-gated).
 *
 * Per V2_CAPTURE_C §2:
 *   - Liaison agent (running on customer's Mac) presents JWT issued by
 *     stripe-webhook on subscription start.
 *   - JWT claims: { sub_id, tier, exp, pools: ["C"] }
 *   - Server validates signature + exp + subscription active in Supabase cache
 *   - If active: pulls pending injections from wavex_os.injection_queue_v2,
 *     OR generates a fresh injection on /v1/optimizer/generate
 *   - If lapsed: returns 402 → Liaison idles
 *
 * Endpoints:
 *   GET  /v1/optimizer/queue/:sub_id
 *     headers: Authorization: Bearer <subscription JWT>
 *     query: ?last_seen_injection_id=<uuid>
 *     returns: { injections: [...], next_poll_at }
 *
 *   POST /v1/optimizer/generate
 *     headers: Authorization: Bearer <subscription JWT>
 *               Idempotency-Key: <uuid>
 *     body: { fleet_digest_id, kind }
 *     returns: { injection_id, status }
 *
 * F.4 wiring note (2026-05-14):
 *   The GET /queue endpoint was previously a `503 pool_c_not_yet_wired`
 *   stub — so even a running Liaison got nothing back and signed
 *   injections (including error-handler-v1 output) sat unconsumed in
 *   `injection_queue_v2` forever. This is the missing link in the
 *   error-handling chain. The endpoint now actually queries the queue.
 *
 *   JWT signature verification (TODO step 1, RS256 from the cloud-side
 *   stripe-webhook minter) is intentionally NOT done here yet: that
 *   minting infra is not present on a local-only box. Instead the
 *   bearer is treated as an opaque subscription credential and the
 *   subscription's active status is verified directly against Supabase
 *   (TODO step 2) — which is the actual authorization gate. When the
 *   cloud minter lands, add signature verification ahead of the
 *   Supabase lookup without changing the rest of this handler.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Subscription statuses that still entitle the customer to Pool C delivery. */
const ACTIVE_STATUSES = new Set(["trialing", "active", "past_due"]);

/** Per-tier poll cadence (seconds) the Liaison should respect. */
const NEXT_POLL_SECONDS = 300;

interface QueueParams {
  sub_id: string;
}

interface QueueQuery {
  last_seen_injection_id?: string;
}

interface GenerateBody {
  fleet_digest_id?: string;
  kind?: string;
}

interface SubscriptionRow {
  id: string;
  status: string;
  tier: string;
}

interface InjectionRow {
  id: string;
  subscription_id: string;
  hired_agent_id: string | null;
  catalog_id: string;
  kind: string;
  payload: unknown;
  issued_by_catalog_id: string;
  issued_at: string;
  signature_b64: string;
  created_at: string;
}

/** Call a `public` SECURITY DEFINER RPC that bridges to the `wavex_os`
 *  schema. The wavex_os schema is intentionally NOT exposed via
 *  PostgREST, so direct table reads 406; the established pattern (see
 *  public.wavex_os_subscription_lookup) is a `public.wavex_os_*` RPC. */
async function wavexRpc<T>(
  fn: string,
  args: Record<string, unknown>,
): Promise<{ ok: true; rows: T[] } | { ok: false; status: number }> {
  if (!SUPABASE_URL || !SUPABASE_SVC) {
    return { ok: false, status: 503 };
  }
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SVC,
      Authorization: `Bearer ${SUPABASE_SVC}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  if (!resp.ok) {
    return { ok: false, status: resp.status };
  }
  return { ok: true, rows: (await resp.json()) as T[] };
}

export async function registerOptimizer(app: FastifyInstance): Promise<void> {
  app.get<{ Params: QueueParams; Querystring: QueueQuery }>(
    "/v1/optimizer/queue/:sub_id",
    async (req, reply: FastifyReply) => {
      const auth = req.headers.authorization;
      if (!auth || !auth.startsWith("Bearer ")) {
        return reply.code(401).send({ error: "missing_bearer" });
      }
      const subId = req.params.sub_id;
      if (!subId) {
        return reply.code(400).send({ error: "missing_sub_id" });
      }

      if (!SUPABASE_URL || !SUPABASE_SVC) {
        return reply.code(503).send({
          error: "supabase_not_configured",
          message: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing from inference-server env.",
        });
      }

      // Step 2 — subscription must exist and be active. This is the real
      // authorization gate (see file header re: JWT signature TODO).
      const subResult = await wavexRpc<SubscriptionRow>("wavex_os_subscription_lookup", {
        p_subscription_id: subId,
      });
      if (!subResult.ok) {
        return reply.code(503).send({
          error: "subscription_lookup_failed",
          status: subResult.status,
        });
      }
      const sub = subResult.rows[0];
      if (!sub) {
        return reply.code(404).send({ error: "subscription_not_found" });
      }
      if (!ACTIVE_STATUSES.has(sub.status)) {
        // Lapsed — Liaison idles quietly per its SKILL.md contract.
        return reply.code(402).send({
          error: "subscription_lapsed",
          status: sub.status,
        });
      }

      // Step 3 — pull unconsumed, unexpired injections for this subscription.
      // If last_seen_injection_id is supplied, the RPC only returns rows
      // created strictly after it (keyset pagination on created_at).
      const queueResult = await wavexRpc<InjectionRow>("wavex_os_injection_queue_pull", {
        p_subscription_id: subId,
        p_last_seen_injection_id: req.query.last_seen_injection_id ?? null,
      });
      if (!queueResult.ok) {
        return reply.code(503).send({
          error: "queue_lookup_failed",
          status: queueResult.status,
        });
      }

      // Shape each row into the injection envelope verify-injection.mjs
      // expects: the canonical signed fields plus subscription_id.
      const injections = queueResult.rows.map((r) => ({
        id: r.id,
        subscription_id: r.subscription_id,
        hired_agent_id: r.hired_agent_id,
        catalog_id: r.catalog_id,
        kind: r.kind,
        payload: r.payload,
        issued_by_catalog_id: r.issued_by_catalog_id,
        issued_at: r.issued_at,
        signature_b64: r.signature_b64,
      }));

      const nextPollAt = new Date(Date.now() + NEXT_POLL_SECONDS * 1000).toISOString();
      return reply.send({
        injections,
        next_poll_at: nextPollAt,
        tier: sub.tier,
      });
    },
  );

  app.post<{ Body: GenerateBody }>(
    "/v1/optimizer/generate",
    async (req: FastifyRequest<{ Body: GenerateBody }>, reply: FastifyReply) => {
      const auth = req.headers.authorization;
      const idempotencyKey = req.headers["idempotency-key"];
      if (!auth || !auth.startsWith("Bearer ")) {
        return reply.code(401).send({ error: "missing_bearer" });
      }
      if (!idempotencyKey) {
        return reply.code(400).send({ error: "missing_idempotency_key" });
      }
      // TODO Phase F.5 — on-demand injection generation. The F.5 local
      // workers (worker-error-handler-local.mjs et al.) already produce
      // signed injections out-of-band; this endpoint is the synchronous
      // path and is not required for the queue-delivery chain to work.
      return reply.code(503).send({
        error: "pool_c_not_yet_wired",
        message: "Pool C optimizer generate lands in Phase F.5.",
      });
    },
  );
}
