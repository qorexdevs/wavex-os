/**
 * Pool C — System Optimizer inference (subscription-gated).
 *
 * Per V2_CAPTURE_C §2:
 *   - Liaison agent (running on customer's Mac) presents JWT issued by
 *     stripe-webhook on subscription start.
 *   - JWT claims: { sub_id, tier, exp, pools: ["C"] }
 *   - Server validates signature + exp + subscription active in Supabase cache
 *   - If active: pulls pending injections from wavex_os.injection_queue,
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
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

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

export async function registerOptimizer(app: FastifyInstance): Promise<void> {
  app.get<{ Params: QueueParams; Querystring: QueueQuery }>(
    "/v1/optimizer/queue/:sub_id",
    async (req, reply: FastifyReply) => {
      const auth = req.headers.authorization;
      if (!auth || !auth.startsWith("Bearer ")) {
        return reply.code(401).send({ error: "missing_bearer" });
      }

      // TODO Phase G.3.c (lands with F.4 Liaison):
      //   1. Verify JWT (RS256, public key bundled at build)
      //   2. Lookup subscription in Supabase cache; reject if not active → 402
      //   3. Query injection_queue for sub_id, where consumed_at IS NULL,
      //      created_at > last_seen_injection_id's created_at
      //   4. Return injections + next_poll_at per tier cadence
      return reply.code(503).send({
        error: "pool_c_not_yet_wired",
        message: "Pool C optimizer queue lands in Phase F.4 (Liaison agent + this endpoint together).",
        retry_after: 60,
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
      // TODO Phase G.3.c
      return reply.code(503).send({
        error: "pool_c_not_yet_wired",
        message: "Pool C optimizer generate lands in Phase F.5.",
      });
    },
  );
}
