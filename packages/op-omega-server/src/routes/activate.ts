/** POST /api/instance/:companyId/activate
 *
 *  Loads the signed company.manifest.json from disk and runs `bridgeAgents`
 *  to materialize the swarm topology + companies row into the wavex DB.
 *  This is the seam where wizard output becomes runtime state.
 *
 *  Idempotent: re-calling against the same companyId after a refinement
 *  upserts cleanly (deterministic agent ids). */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { CompanyManifest } from "@op-omega/plugin-onboarding";
import { assertBoard, assertCompanyAccess, AuthError } from "@wavex-os/auth-shim";
import { getDb, runMigrations } from "@wavex-os/db";
import { getOnboardingDir } from "../state-bridge.js";
import { bridgeAgents } from "../bridge/finalize-bridge.js";

function authReq(req: FastifyRequest) {
  return { method: req.method, headers: req.headers as Record<string, string> };
}

let migrationsRun = false;
async function ensureMigrations(): Promise<void> {
  if (migrationsRun) return;
  await runMigrations();
  migrationsRun = true;
}

export function registerActivateRoute(app: FastifyInstance): void {
  app.post("/api/instance/:companyId/activate", async (req, reply) => {
    const ar = authReq(req);
    try { assertBoard(ar); } catch (e) {
      if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
      throw e;
    }
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(ar, companyId);

    let manifest: CompanyManifest;
    try {
      const path = join(getOnboardingDir(companyId), "company.manifest.json");
      const raw = await readFile(path, "utf8");
      manifest = JSON.parse(raw) as CompanyManifest;
    } catch {
      return reply.status(404).send({
        ok: false,
        error: "manifest not found — finalize the wizard first",
        companyId,
      });
    }

    try {
      await ensureMigrations();
      const db = await getDb();
      const result = await bridgeAgents(manifest, companyId, db);
      return {
        ok: true,
        inserted: { companies: result.companies, agents: result.agents },
        warnings: result.warnings,
      };
    } catch (e) {
      return reply.status(500).send({
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  });
}
