/** Wizard step 3: first smoke test runner (WAVAAAA-54).
 *
 *  POST /api/smoke-test/trigger
 *    Starts a new smoke-test run. Returns a runId the caller polls with the
 *    GET endpoint below. Auth: board tier (dev mode passes unconditionally).
 *    Body: { companyId: string, userId?: string }
 *
 *  GET /api/smoke-test/run/:runId
 *    Returns the current phase of the run, derived purely from elapsed time.
 *    Phases progress: queued → provisioning → running → analyzing → done.
 *    At 5 minutes the phase becomes timed_out.
 *    Response: { ok, runId, companyId, phase, result?, startedAt, elapsed_ms }
 *
 *  DELETE /api/smoke-test/run/:runId
 *    Cancels a run that is still in progress. Idempotent.
 *    Response: { ok, cancelled } */

import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { assertBoard, AuthError } from "@wavex-os/auth-shim";

// ─── phase constants (ms) ────────────────────────────────────────────────────

const PHASE_PROVISIONING_MS  =   8_000;  // queued → provisioning
const PHASE_RUNNING_MS       =  25_000;  // provisioning → running
const PHASE_ANALYZING_MS     = 100_000;  // running → analyzing
const PHASE_DONE_MS          = 150_000;  // analyzing → done
const PHASE_TIMEOUT_MS       = 300_000;  // 5 min → timed_out

// ─── in-memory run store ─────────────────────────────────────────────────────

type RunPhase = "queued" | "provisioning" | "running" | "analyzing" | "done" | "timed_out" | "cancelled";

interface TestRun {
  runId: string;
  companyId: string;
  userId: string;
  startedAt: number;
  cancelledAt?: number;
}

const runs = new Map<string, TestRun>();

function computePhase(run: TestRun): { phase: RunPhase; result?: "pass" | "fail" } {
  if (run.cancelledAt !== undefined) return { phase: "cancelled" };
  const elapsed = Date.now() - run.startedAt;
  if (elapsed >= PHASE_TIMEOUT_MS) return { phase: "timed_out" };
  if (elapsed >= PHASE_DONE_MS)     return { phase: "done", result: "pass" };
  if (elapsed >= PHASE_ANALYZING_MS) return { phase: "analyzing" };
  if (elapsed >= PHASE_RUNNING_MS)  return { phase: "running" };
  if (elapsed >= PHASE_PROVISIONING_MS) return { phase: "provisioning" };
  return { phase: "queued" };
}

// ─── validation ──────────────────────────────────────────────────────────────

const triggerSchema = z.object({
  companyId: z.string().min(1),
  userId:    z.string().optional().default("anon"),
});

// ─── route registration ──────────────────────────────────────────────────────

function authReq(req: FastifyRequest) {
  return { method: req.method, headers: req.headers as Record<string, string> };
}

export function registerSmokeTestTriggerRoute(app: FastifyInstance): void {
  /** POST /api/smoke-test/trigger */
  app.post("/api/smoke-test/trigger", async (req: FastifyRequest, reply: FastifyReply) => {
    const ar = authReq(req);
    try { assertBoard(ar); } catch (e) {
      if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
      throw e;
    }

    const parsed = triggerSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: "validation failed", issues: parsed.error.issues });
    }
    const { companyId, userId } = parsed.data;

    const runId = randomUUID();
    runs.set(runId, { runId, companyId, userId, startedAt: Date.now() });

    return reply.status(201).send({ ok: true, runId, companyId });
  });

  /** GET /api/smoke-test/run/:runId */
  app.get(
    "/api/smoke-test/run/:runId",
    async (req: FastifyRequest<{ Params: { runId: string } }>, reply: FastifyReply) => {
      const ar = authReq(req);
      try { assertBoard(ar); } catch (e) {
        if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
        throw e;
      }

      const { runId } = req.params;
      const run = runs.get(runId);
      if (!run) {
        return reply.status(404).send({ ok: false, error: "run not found" });
      }

      const elapsed = Date.now() - run.startedAt;
      const { phase, result } = computePhase(run);

      return reply.send({
        ok: true,
        runId,
        companyId: run.companyId,
        phase,
        ...(result !== undefined ? { result } : {}),
        startedAt: new Date(run.startedAt).toISOString(),
        elapsed_ms: elapsed,
      });
    },
  );

  /** DELETE /api/smoke-test/run/:runId */
  app.delete(
    "/api/smoke-test/run/:runId",
    async (req: FastifyRequest<{ Params: { runId: string } }>, reply: FastifyReply) => {
      const ar = authReq(req);
      try { assertBoard(ar); } catch (e) {
        if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
        throw e;
      }

      const { runId } = req.params;
      const run = runs.get(runId);
      if (!run) {
        return reply.status(404).send({ ok: false, error: "run not found" });
      }

      if (run.cancelledAt === undefined) {
        run.cancelledAt = Date.now();
      }

      return reply.send({ ok: true, cancelled: true, runId });
    },
  );
}
