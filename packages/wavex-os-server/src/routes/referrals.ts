/** Referral v1 routes (WAVAAAA-81 / WAVAAAA-106)
 *
 *  POST /api/referrals/dismiss
 *    Sets referral_modal_dismissed_at = NOW() for the calling user.
 *    Idempotent: subsequent calls are no-ops (timestamp already set).
 *    Returns { ok: true, user }.
 *
 *  POST /api/referrals/email-b/run  [instance-admin only]
 *    Manual trigger for the Email B cron job.
 *    Returns { ok: true, checked, sent, skipped }.
 *    Useful for ops/debugging; the scheduler fires automatically every hour. */

import { eq } from "drizzle-orm";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { assertBoard, AuthError, type AuthRequest } from "@wavex-os/auth-shim";
import { getDb, runMigrations, users } from "@wavex-os/db";
import { runReferralEmailBJob } from "../jobs/referral-email-b.js";

let migrationsRun = false;
async function ensureMigrations(): Promise<void> {
  if (migrationsRun) return;
  await runMigrations();
  migrationsRun = true;
}

function authReq(req: FastifyRequest): AuthRequest {
  return { method: req.method, headers: req.headers as Record<string, string> };
}

export function registerReferralRoutes(app: FastifyInstance): void {
  /** POST /api/referrals/dismiss
   *  Records that the referral modal was dismissed; starts the T+24h Email B
   *  countdown for this user. Idempotent — does nothing if already dismissed. */
  app.post("/api/referrals/dismiss", async (req: FastifyRequest, reply: FastifyReply) => {
    const ar = authReq(req);
    try { assertBoard(ar); } catch (e) {
      if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
      throw e;
    }

    await ensureMigrations();
    const db = await getDb();
    const actor = ar.actor!;
    const userId = actor.type === "board" ? actor.userId : actor.agentId;

    const [existing] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    // Already dismissed — idempotent, return current state
    if (existing?.referralModalDismissedAt) {
      return { ok: true, user: existing };
    }

    const now = new Date();
    const [updated] = await db
      .insert(users)
      .values({ id: userId, referralModalDismissedAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: users.id,
        set: { referralModalDismissedAt: now, updatedAt: now },
      })
      .returning();

    return { ok: true, user: updated };
  });

  /** POST /api/referrals/email-b/run
   *  Instance-admin–only manual trigger for the Email B cron job.
   *  Runs the same query + send logic as the hourly scheduler. */
  app.post("/api/referrals/email-b/run", async (req: FastifyRequest, reply: FastifyReply) => {
    const ar = authReq(req);
    try { assertBoard(ar); } catch (e) {
      if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
      throw e;
    }

    const actor = ar.actor!;
    const isAdmin =
      actor.type === "board" &&
      (actor.source === "local_implicit" || actor.isInstanceAdmin);

    if (!isAdmin) {
      return reply.status(403).send({ error: "Instance admin access required" });
    }

    const result = await runReferralEmailBJob();
    return { ok: true, ...result };
  });
}
