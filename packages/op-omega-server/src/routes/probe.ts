/** Claude Code health probe — Pillar 2's prerequisite check. Forwards to
 *  the vendored plugin's probe; the plugin spawns the configured claudeBin
 *  and reports installed/authenticated state. */
import type { FastifyInstance, FastifyRequest } from "fastify";
import { probeClaudeCode } from "@op-omega/plugin-onboarding";
import { assertBoard, AuthError } from "@wavex-os/auth-shim";
import { getClaudeBin } from "@wavex-os/inference-adapter";

function authReq(req: FastifyRequest) {
  return { method: req.method, headers: req.headers as Record<string, string> };
}

export function registerProbeRoutes(app: FastifyInstance): void {
  app.get("/op-omega/onboarding/claude-code-check", async (req, reply) => {
    const ar = authReq(req);
    try { assertBoard(ar); } catch (e) {
      if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
      throw e;
    }
    try {
      const probe = await probeClaudeCode({ bin: getClaudeBin() });
      return { ok: true, probe };
    } catch (e) {
      return reply.status(503).send({
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  });

  app.get("/op-omega/onboarding/loop-status", async (req, reply) => {
    const ar = authReq(req);
    try { assertBoard(ar); } catch (e) {
      if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
      throw e;
    }
    // Minimal placeholder — the upstream loop-status reads from the
    // budget-policy + cost-event tables. Wired in STEP 13.
    return { ok: true, loop: { status: "idle", lastTick: null } };
  });
}
