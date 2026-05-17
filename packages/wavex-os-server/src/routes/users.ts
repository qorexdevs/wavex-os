/** User profile endpoints.
 *
 *  Endpoints:
 *    GET  /api/users/me
 *           Returns the current user record, creating it on first access.
 *           Includes is_new_user so the frontend can gate the onboarding wizard.
 *    PATCH /api/users/:id/wizard-step
 *           Persists the current wizard step (1–3) so the wizard resumes at
 *           the correct step after a page refresh.
 *           Returns 200 { ok: true, user } on success.
 *    PATCH /api/users/:id/complete-wizard
 *           Sets is_new_user = false and records wizard_completed_at.
 *           Returns 200 { ok: true, user } on success. */

import { eq } from "drizzle-orm";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { assertBoard, AuthError, type AuthRequest } from "@wavex-os/auth-shim";
import { getDb, runMigrations, users } from "@wavex-os/db";

let migrationsRun = false;
async function ensureMigrations(): Promise<void> {
  if (migrationsRun) return;
  await runMigrations();
  migrationsRun = true;
}

function authReq(req: FastifyRequest): AuthRequest {
  return { method: req.method, headers: req.headers as Record<string, string> };
}

export function registerUserRoutes(app: FastifyInstance): void {
  /** GET /api/users/me
   *  Upsert-on-read: creates the user record on first call (is_new_user: true).
   *  Subsequent reads return the stored record. */
  app.get("/api/users/me", async (req, reply) => {
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
    if (existing) {
      return { ok: true, user: existing };
    }

    const [created] = await db
      .insert(users)
      .values({ id: userId, isNewUser: true })
      .returning();
    return { ok: true, user: created };
  });

  /** PATCH /api/users/:id/wizard-step
   *  Saves the user's current wizard step so the wizard resumes at the right
   *  place after a page refresh. Only the user themselves or an admin may call. */
  app.patch("/api/users/:id/wizard-step", async (req, reply) => {
    const ar = authReq(req);
    try { assertBoard(ar); } catch (e) {
      if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
      throw e;
    }

    const { id: targetId } = req.params as { id: string };
    const actor = ar.actor!;
    const callerId = actor.type === "board" ? actor.userId : actor.agentId;
    const isAdmin = actor.type === "board" && (actor.source === "local_implicit" || actor.isInstanceAdmin);
    if (!isAdmin && callerId !== targetId) {
      return reply.status(403).send({ error: "Cannot update wizard step for another user" });
    }

    const { step } = req.body as { step: number };
    if (typeof step !== "number" || step < 1 || step > 3) {
      return reply.status(400).send({ error: "step must be 1, 2, or 3" });
    }

    await ensureMigrations();
    const db = await getDb();
    const now = new Date();
    const [updated] = await db
      .insert(users)
      .values({ id: targetId, wizardStep: step, updatedAt: now })
      .onConflictDoUpdate({
        target: users.id,
        set: { wizardStep: step, updatedAt: now },
      })
      .returning();

    return { ok: true, user: updated };
  });

  /** PATCH /api/users/:id/complete-wizard
   *  Marks the wizard as complete for the given user id.
   *  Only the user themselves (or an instance admin) may call this. */
  app.patch("/api/users/:id/complete-wizard", async (req, reply) => {
    const ar = authReq(req);
    try { assertBoard(ar); } catch (e) {
      if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
      throw e;
    }

    const { id: targetId } = req.params as { id: string };
    const actor = ar.actor!;
    const callerId = actor.type === "board" ? actor.userId : actor.agentId;

    // Only the user themselves or an instance admin may complete the wizard.
    const isAdmin = actor.type === "board" && (actor.source === "local_implicit" || actor.isInstanceAdmin);
    if (!isAdmin && callerId !== targetId) {
      return reply.status(403).send({ error: "Cannot complete wizard for another user" });
    }

    await ensureMigrations();
    const db = await getDb();

    // Upsert: if the user row doesn't exist yet, create it already completed.
    const now = new Date();
    const [updated] = await db
      .insert(users)
      .values({ id: targetId, isNewUser: false, wizardCompletedAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: users.id,
        set: { isNewUser: false, wizardCompletedAt: now, updatedAt: now },
      })
      .returning();

    return { ok: true, user: updated };
  });
}
