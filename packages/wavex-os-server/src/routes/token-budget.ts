/** GET / POST /api/instance/:companyId/token-budget
 *
 *  GET: returns the current cap (or null if unset).
 *  POST: sets/raises/clears the cap.
 *    body { cap_tokens: number | null }
 *
 *  When the cap is reached, withTokenAccounting throws BudgetExhaustedError
 *  before each T2 call; this route registrar's pillars/phases handlers
 *  catch it and return 429 so the UI can surface a "raise budget" prompt. */

import { z } from "zod";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { assertBoard, assertCompanyAccess, AuthError } from "@wavex-os/auth-shim";
import { readBudget, writeBudget } from "../lib/token-budget.js";
import { currentSpend } from "../lib/token-budget.js";

const setSchema = z.object({
  cap_tokens: z.number().int().positive().nullable(),
});

function authReq(req: FastifyRequest) {
  return { method: req.method, headers: req.headers as Record<string, string> };
}

export function registerTokenBudgetRoute(app: FastifyInstance): void {
  app.get("/api/instance/:companyId/token-budget", async (req, reply) => {
    const ar = authReq(req);
    try { assertBoard(ar); } catch (e) {
      if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
      throw e;
    }
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(ar, companyId);
    const budget = await readBudget(companyId);
    const used = await currentSpend(companyId);
    return { ok: true, budget, used };
  });

  app.post("/api/instance/:companyId/token-budget", async (req, reply) => {
    const ar = authReq(req);
    try { assertBoard(ar); } catch (e) {
      if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
      throw e;
    }
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(ar, companyId);
    const parsed = setSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: "validation failed", issues: parsed.error.issues });
    }
    const budget = await writeBudget(companyId, parsed.data.cap_tokens);
    return { ok: true, budget };
  });
}
