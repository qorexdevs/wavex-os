/** DELETE /api/instance/:companyId/reset
 *
 *  Wipes ALL state for a single company so the operator can re-walk
 *  onboarding from Pillar 1 with a clean slate. Destructive — UI gates
 *  with a confirm modal.
 *
 *  Wipes:
 *    - Filesystem: ~/.wavex-os/instances/default/companies/<id>/onboarding/
 *      (entire directory: pillar_responses, all manifests, signatures,
 *       mc-report, refinement_history)
 *    - DB: companies + agents + credentials + credential_audit_log
 *      + company_kpis + kpi_snapshots + cost_events + heartbeat_runs
 *      + issues + issue_comments + task_outcome_attributions
 *      (every row WHERE company_id = :companyId, plus heartbeat_runs +
 *       issue_comments resolved by FK to wiped agents/issues)
 *
 *  Returns counts of what was deleted so the UI can show a summary. */

import { rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { eq, inArray, sql } from "drizzle-orm";
import { assertBoard, assertCompanyAccess, AuthError } from "@wavex-os/auth-shim";
import {
  getDb, runMigrations,
  agents, companies, credentials, credentialAuditLog,
  companyKpis, kpiSnapshots,
  costEvents,
  issues, issueComments, taskOutcomeAttributions,
  heartbeatRuns,
} from "@wavex-os/db";
import { getOnboardingDir } from "../state-bridge.js";

function authReq(req: FastifyRequest) {
  return { method: req.method, headers: req.headers as Record<string, string> };
}

let migrationsRun = false;
async function ensureMigrations(): Promise<void> {
  if (migrationsRun) return;
  await runMigrations();
  migrationsRun = true;
}

interface ResetReport {
  ok: true;
  companyId: string;
  filesystemRemoved: boolean;
  dbDeletedRows: {
    companies: number;
    agents: number;
    credentials: number;
    credentialAuditLog: number;
    companyKpis: number;
    kpiSnapshots: number;
    costEvents: number;
    issues: number;
    issueComments: number;
    taskOutcomeAttributions: number;
    heartbeatRuns: number;
  };
}

export function registerResetRoute(app: FastifyInstance): void {
  app.delete("/api/instance/:companyId/reset", async (req, reply) => {
    const ar = authReq(req);
    try { assertBoard(ar); } catch (e) {
      if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
      throw e;
    }
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(ar, companyId);

    // 1. Wipe filesystem — onboarding dir + parent company dir, so the
    //    company drops out of /api/companies (which enumerates by directory).
    let filesystemRemoved = false;
    try {
      const onboardingDir = getOnboardingDir(companyId);
      const companyDir = dirname(onboardingDir); // .../companies/<id>
      if (existsSync(companyDir)) {
        await rm(companyDir, { recursive: true, force: true });
        filesystemRemoved = true;
      }
    } catch (e) {
      // Continue to DB wipe even if filesystem fails — partial reset still useful
      // eslint-disable-next-line no-console
      console.warn(`[reset] filesystem wipe failed for ${companyId}:`, (e as Error).message);
    }

    // 2. Wipe DB rows
    let report: ResetReport["dbDeletedRows"];
    try {
      await ensureMigrations();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = (await getDb()) as any;

      // Resolve agent ids first so heartbeat_runs (no companyId column) can be wiped
      const agentRows = await db.select({ id: agents.id }).from(agents).where(eq(agents.companyId, companyId)) as Array<{ id: string }>;
      const agentIds = agentRows.map((r) => r.id);

      // Resolve issue ids first so issue_comments (no companyId column) can be wiped
      const issueRows = await db.select({ id: issues.id }).from(issues).where(eq(issues.companyId, companyId)) as Array<{ id: string }>;
      const issueIds = issueRows.map((r) => r.id);

      // Pre-count then delete (drizzle's .returning() rejects under the
      // pglite|postgres-js union type — count-then-delete sidesteps it.)
      async function countWhere(table: unknown, whereClause: unknown): Promise<number> {
        const rows = await db.select({ c: sql<number>`count(*)::int` })
          .from(table).where(whereClause) as Array<{ c: number }>;
        return rows[0]?.c ?? 0;
      }

      const counts = {
        companies: await countWhere(companies, eq(companies.id, companyId)),
        agents: agentIds.length,
        credentials: await countWhere(credentials, eq(credentials.companyId, companyId)),
        credentialAuditLog: await countWhere(credentialAuditLog, eq(credentialAuditLog.companyId, companyId)),
        companyKpis: await countWhere(companyKpis, eq(companyKpis.companyId, companyId)),
        kpiSnapshots: await countWhere(kpiSnapshots, eq(kpiSnapshots.companyId, companyId)),
        costEvents: await countWhere(costEvents, eq(costEvents.companyId, companyId)),
        issues: issueIds.length,
        issueComments: issueIds.length > 0 ? await countWhere(issueComments, inArray(issueComments.issueId, issueIds)) : 0,
        taskOutcomeAttributions: await countWhere(taskOutcomeAttributions, eq(taskOutcomeAttributions.companyId, companyId)),
        heartbeatRuns: agentIds.length > 0 ? await countWhere(heartbeatRuns, inArray(heartbeatRuns.agentId, agentIds)) : 0,
      };

      // Delete in FK-safe order: leaves first, then trunks
      if (agentIds.length > 0) {
        await db.delete(heartbeatRuns).where(inArray(heartbeatRuns.agentId, agentIds));
      }
      if (issueIds.length > 0) {
        await db.delete(issueComments).where(inArray(issueComments.issueId, issueIds));
      }
      await db.delete(taskOutcomeAttributions).where(eq(taskOutcomeAttributions.companyId, companyId));
      await db.delete(issues).where(eq(issues.companyId, companyId));
      await db.delete(costEvents).where(eq(costEvents.companyId, companyId));
      await db.delete(kpiSnapshots).where(eq(kpiSnapshots.companyId, companyId));
      await db.delete(companyKpis).where(eq(companyKpis.companyId, companyId));
      await db.delete(credentialAuditLog).where(eq(credentialAuditLog.companyId, companyId));
      await db.delete(credentials).where(eq(credentials.companyId, companyId));
      await db.delete(agents).where(eq(agents.companyId, companyId));
      await db.delete(companies).where(eq(companies.id, companyId));

      report = counts;
    } catch (e) {
      return reply.status(500).send({
        ok: false,
        error: `db wipe failed: ${e instanceof Error ? e.message : String(e)}`,
        filesystemRemoved,
      });
    }

    const out: ResetReport = {
      ok: true,
      companyId,
      filesystemRemoved,
      dbDeletedRows: report,
    };
    return out;
  });
}
