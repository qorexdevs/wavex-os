/** POST /op-omega/onboarding/pillar/:n/suggest-pool-b
 *
 *  Pool B variant of pillar-suggest. Instead of going through tier-router
 *  (which calls the operator's local OAuth via the Pool A hub), this route
 *  routes through @wavex-os/cloud-client.cloudInference() — the Supabase
 *  Realtime path that bills against the operator's Claude Max under the
 *  CUSTOMER's subscription.
 *
 *  This is the first real-consumer wiring of the Pool B path. The browser
 *  picks this endpoint when device-token.json is present + unexpired
 *  (validated by GET /api/inference-status). Otherwise it stays on the
 *  existing Pool A endpoint.
 *
 *  Only pillar 3 is exercised by the UI today — the other pillars keep
 *  using Pool A until this is proven. The handler still supports n ∈ {3, 4, 5}
 *  so a future surface can opt in without a code change. */

import { z } from "zod";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { cloudInference } from "@wavex-os/cloud-client";
import { assertBoard, assertCompanyAccess, AuthError } from "@wavex-os/auth-shim";

const bodySchema = z.object({ companyId: z.string().min(1) });

function authReq(req: FastifyRequest) {
  return { method: req.method, headers: req.headers as Record<string, string> };
}

export function registerPillarSuggestPoolBRoute(app: FastifyInstance): void {
  app.post<{ Body: { companyId: string }; Params: { n: string } }>(
    "/op-omega/onboarding/pillar/:n/suggest-pool-b",
    async (req, reply) => {
      const ar = authReq(req);
      try { assertBoard(ar); } catch (e) {
        if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
        throw e;
      }
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) return reply.status(400).send({ error: "validation failed" });
      const { companyId } = parsed.data;
      assertCompanyAccess(ar, companyId);
      const n = parseInt(req.params.n, 10);
      if (![3, 4, 5].includes(n)) {
        return reply.status(400).send({ error: "suggest-pool-b only supports pillars 3, 4, 5" });
      }

      // Tiny prompt — this is a smoke test of the Pool B path. The Pool A
      // route does the full context-aware suggestion; Pool B mirrors enough
      // to validate the wire without burning tokens.
      const prompt = `Suggest the most generic safe defaults for Pillar ${n} of an onboarding wizard. Output ONLY a single-line JSON: {"recommended":{},"reasoning":"pool-b warm-up"}.`;

      try {
        const r = await cloudInference({
          prompt,
          max_output_tokens: 80,
          purpose: `onboarding.pillar-${n}-suggest`,
        });
        if (!r.ok) {
          return reply.status(502).send({
            ok: false,
            error: r.error,
            message: r.message,
            mode: "pool_b" as const,
          });
        }
        let parsedOut: { recommended?: Record<string, unknown>; reasoning?: string } = {};
        try { parsedOut = JSON.parse(r.content); } catch { /* leave empty */ }
        return {
          ok: true,
          pillar: n,
          recommended: parsedOut.recommended ?? {},
          reasoning: parsedOut.reasoning ?? null,
          mode: "pool_b" as const,
        };
      } catch (e) {
        return reply.status(502).send({
          ok: false,
          error: e instanceof Error ? e.message : String(e),
          mode: "pool_b" as const,
        });
      }
    },
  );
}
