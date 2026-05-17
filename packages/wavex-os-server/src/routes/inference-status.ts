/** GET /api/inference/current
 *
 *  Returns the wavex-claude-spawn.sh wrapper's most-recent inference event.
 *  When a T2 call is in flight, surface real elapsed time + alive status so
 *  the UI can show truthful progress instead of fake timer-based stages.
 *
 *  Single-process semantics: in dev there's only ever one T2 call running
 *  at a time. Multi-tenant production would need per-context tracking. */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { getWavexDataRoot } from "../state-bridge.js";
import { getAllPhaseEtas, getPhaseEta, type PhaseKey } from "../lib/token-accounting.js";

interface InferenceStatus {
  started_at_ms: number;
  pid: number;
  alive: boolean;
  elapsed_ms: number;
  completed: boolean;
  exit_code?: number;
  updated_at_ms: number;
}

export function registerInferenceStatusRoute(app: FastifyInstance): void {
  app.get("/api/inference/current", async (_req, reply) => {
    try {
      const path = join(getWavexDataRoot(), "state", "inference-current.json");
      const raw = await readFile(path, "utf8");
      const status = JSON.parse(raw) as InferenceStatus;

      // If the file is "active" (alive) but stale (no heartbeat in 6s), the
      // wrapper crashed without writing the completion record. Mark stale
      // explicitly so the UI doesn't show forever-running.
      const now = Date.now();
      const stale = status.alive && (now - status.updated_at_ms > 6000);
      return {
        ok: true,
        ...status,
        stale,
        // Keep a derived elapsed for the UI even when we haven't heartbeated yet.
        live_elapsed_ms: status.completed
          ? status.elapsed_ms
          : Math.max(status.elapsed_ms, now - status.started_at_ms),
      };
    } catch {
      // No state file yet — wrapper hasn't run, return empty signal.
      return { ok: true, idle: true };
    }
  });

  /** GET /api/inference/eta — per-phase median + p90 durations from history.
   *  With ?phase= returns one row; without, returns all. Powers the wizard's
   *  time-estimate UI (replaces the previously-hardcoded ETA_SECONDS). */
  app.get("/api/inference/eta", async (req) => {
    const { phase } = (req.query ?? {}) as { phase?: string };
    if (phase) {
      const eta = await getPhaseEta(phase as PhaseKey);
      return { ok: true, eta };
    }
    const etas = await getAllPhaseEtas();
    return { ok: true, etas };
  });
}
