/** GET /api/instance/:companyId/token-usage
 *
 *  Returns the per-company T2 token aggregate written by withTokenAccounting.
 *  Returns a zeroed-empty payload when no T2 calls have been recorded yet
 *  (file missing — fresh wizard or post-Reset). Previously this branch
 *  returned 404, which the UI swallowed but the browser still logged to
 *  the console, producing visible "404" noise after a Reset where the
 *  TokenCounter polls every 5s. 200 with an empty aggregate keeps the
 *  TokenCounter's existing "🪙 0 · <$0.01" rendering and clears the
 *  console-error noise the customer sees. */

import type { FastifyInstance, FastifyRequest } from "fastify";
import { assertBoard, assertCompanyAccess, AuthError } from "@wavex-os/auth-shim";
import { readTokenUsage } from "../lib/token-accounting.js";

function authReq(req: FastifyRequest) {
  return { method: req.method, headers: req.headers as Record<string, string> };
}

export function registerTokenUsageRoute(app: FastifyInstance): void {
  app.get("/api/instance/:companyId/token-usage", async (req, reply) => {
    const ar = authReq(req);
    try { assertBoard(ar); } catch (e) {
      if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
      throw e;
    }
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(ar, companyId);
    const usage = await readTokenUsage(companyId);
    if (!usage) {
      const now = new Date().toISOString();
      return {
        ok: true,
        usage: {
          companyId,
          started_at: now,
          updated_at: now,
          total: { input_tokens: 0, output_tokens: 0, cached_input_tokens: 0, cost_usd: 0, duration_ms: 0, calls: 0 },
          by_phase: {},
          recent_calls: [],
        },
      };
    }
    return { ok: true, usage };
  });
}
