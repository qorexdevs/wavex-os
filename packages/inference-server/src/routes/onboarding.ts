/**
 * Pool A — onboarding T2 enrichment.
 *
 * Anonymous, rate-limited. Per V2_CAPTURE_C §4:
 *   - 20 T2 calls per install_id, lifetime
 *   - 5 per hour per install_id
 *   - 200 T2 calls / hour per IP /24
 *   - 3 install_ids per email per 30 days
 *   - $10/day global Pool A cap (hard kill switch)
 *   - 8K output-token cap per call
 *
 * Endpoints:
 *   POST /v1/onboarding/session
 *     body: { email, install_id }
 *     returns: { token } (HS256, 30min)
 *
 *   POST /v1/onboarding/t2
 *     headers: Authorization: Bearer <session token>
 *     body: { prompt, max_output_tokens? }
 *     returns: { content, model, usage }
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

interface SessionBody {
  email?: string;
  install_id?: string;
}

interface T2Body {
  prompt?: string;
  max_output_tokens?: number;
}

export async function registerOnboarding(app: FastifyInstance): Promise<void> {
  app.post<{ Body: SessionBody }>(
    "/v1/onboarding/session",
    async (req: FastifyRequest<{ Body: SessionBody }>, reply: FastifyReply) => {
      const { email, install_id } = req.body ?? {};
      if (!email || !install_id) {
        return reply.code(400).send({ error: "missing_fields", required: ["email", "install_id"] });
      }
      // TODO Phase G.3.b — issue actual HS256 token, enforce per-email rate limit.
      // Stub: return placeholder token so the wizard's plumbing can be exercised.
      return reply.send({
        token: `stub_${install_id}_${Date.now()}`,
        expires_in: 1800,
        note: "Phase G.3 stub — real JWT issuance lands in G.3.b",
      });
    },
  );

  app.post<{ Body: T2Body }>(
    "/v1/onboarding/t2",
    async (req: FastifyRequest<{ Body: T2Body }>, reply: FastifyReply) => {
      const auth = req.headers.authorization;
      if (!auth || !auth.startsWith("Bearer ")) {
        return reply.code(401).send({ error: "missing_bearer" });
      }

      // TODO Phase G.3.b:
      //   1. Verify JWT signature + exp
      //   2. Check Redis: per-install-id lifetime + hourly caps
      //   3. Check Redis: per-IP/24 hourly cap
      //   4. Check global ledger for $10/day Pool A cap
      //   5. Call Anthropic with operator's OAuth token
      //   6. Stream response
      //   7. Async: write to wavex_os.usage_ledger
      //
      // For now, return 503 so callers exercise the T1 deterministic fallback path.
      return reply.code(503).send({
        error: "pool_a_not_yet_wired",
        message: "Pool A inference will be wired in Phase G.3.b. Wizard should fall back to T1 deterministic mode per V2_CAPTURE_C §5.",
        retry_after: 0,
      });
    },
  );
}
