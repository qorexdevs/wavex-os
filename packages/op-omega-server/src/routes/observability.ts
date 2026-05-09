/** Observability endpoints — surface mission-control aggregator + budget
 *  status against the wavex Drizzle database. Backed by @wavex-os/db
 *  satisfying the DbExecutor contract that @wavex-os/observability expects.
 *
 *  These endpoints are best-effort: they return structured "no data" shapes
 *  rather than throwing when the underlying tables are empty (typical for
 *  a freshly-onboarded company with no cost events / KPI snapshots yet). */

import type { FastifyInstance, FastifyRequest } from "fastify";
import { assertBoard, assertCompanyAccess, AuthError } from "@wavex-os/auth-shim";
import { getDb } from "@wavex-os/db";
import {
  preloadSqlTag,
  getMissionControl,
  getBudgetStatus,
  computeBottlenecks,
} from "@wavex-os/observability";

let preloaded = false;
async function ensureSqlTag(): Promise<void> {
  if (preloaded) return;
  await preloadSqlTag();
  preloaded = true;
}

function authReq(req: FastifyRequest) {
  return { method: req.method, headers: req.headers as Record<string, string> };
}

export function registerObservabilityRoutes(app: FastifyInstance): void {
  app.get("/api/observability/:companyId/mission-control", async (req, reply) => {
    const ar = authReq(req);
    try { assertBoard(ar); } catch (e) {
      if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
      throw e;
    }
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(ar, companyId);
    await ensureSqlTag();
    try {
      const db = await getDb();
      const mc = await getMissionControl(db as never, companyId);
      return { ok: true, data: mc };
    } catch (e) {
      return reply.status(503).send({
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        hint: "Tables likely empty for a fresh company; check ~/.wavex-os/db/ + run pnpm db:up.",
      });
    }
  });

  app.get("/api/observability/:companyId/budget", async (req, reply) => {
    const ar = authReq(req);
    try { assertBoard(ar); } catch (e) {
      if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
      throw e;
    }
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(ar, companyId);
    await ensureSqlTag();
    try {
      const db = await getDb();
      const status = await getBudgetStatus(db as never, companyId);
      return { ok: true, data: status };
    } catch (e) {
      return reply.status(503).send({
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  });

  app.get("/api/observability/:companyId/bottlenecks", async (req, reply) => {
    const ar = authReq(req);
    try { assertBoard(ar); } catch (e) {
      if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
      throw e;
    }
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(ar, companyId);
    await ensureSqlTag();
    try {
      const db = await getDb();
      const rows = await computeBottlenecks(db as never, companyId);
      return { ok: true, data: rows };
    } catch (e) {
      return reply.status(503).send({
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  });
}
