/** GET /api/instance/:companyId/token-usage
 *
 *  Returns the per-company T2 token aggregate written by withTokenAccounting.
 *  404 when no T2 calls have been made yet (file doesn't exist). The UI
 *  treats 404 as "0 tokens" so a fresh wizard doesn't error out. */

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
      return reply.status(404).send({ ok: false, error: "no token usage recorded yet" });
    }
    return { ok: true, usage };
  });
}
