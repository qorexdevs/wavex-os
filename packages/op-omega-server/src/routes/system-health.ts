/** GET /api/system/health — surface the local-ops daemon's last state file.
 *  POST /api/system/health/run-now — kick off an ad-hoc cycle.
 *
 *  The state file is written every 5 min by scripts/wavex-local-ops-cycle.mjs
 *  (driven by launchd on Mac / Scheduled Task on Windows / systemd-user on
 *  Linux). Phase C UI reads this to render the "System health" chip.
 *
 *  Shape (FROZEN — schema_version=1):
 *    { schema_version, ran_at, ran_at_iso, next_run_at, cycle_duration_ms,
 *      checks: { token, git, install, build, processes } | null,
 *      requires_user_action: null | { reason, button_label, detail } }
 *
 *  First-call behavior when state file doesn't exist yet: returns a stub
 *  with ran_at=0 and checks=null. UI should render a neutral "Checking…"
 *  chip in that case. */

import type { FastifyInstance } from "fastify";
import { promises as fs } from "node:fs";
import path from "node:path";
import { homedir } from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(homedir(), ".wavex-os", "local-ops-state.json");
// Walk up from packages/op-omega-server/src/routes/ → repo root.
const DAEMON_SCRIPT =
  process.env.WAVEX_LOCAL_OPS_SCRIPT ??
  path.resolve(__dirname, "../../../..", "scripts/wavex-local-ops-cycle.mjs");

function emptyState() {
  return {
    schema_version: 1,
    ran_at: 0,
    ran_at_iso: null,
    next_run_at: 0,
    cycle_duration_ms: 0,
    checks: null,
    requires_user_action: null,
  };
}

export function registerSystemHealthRoute(app: FastifyInstance): void {
  app.get("/api/system/health", async () => {
    try {
      const raw = await fs.readFile(STATE_FILE, "utf8");
      return JSON.parse(raw);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return emptyState();
      return { ...emptyState(), error: err instanceof Error ? err.message : String(err) };
    }
  });

  app.post("/api/system/health/run-now", async () => {
    try {
      await fs.access(DAEMON_SCRIPT);
    } catch {
      return { ok: false, error: `daemon script missing at ${DAEMON_SCRIPT}` };
    }
    const child = spawn(process.execPath, [DAEMON_SCRIPT], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    return { ok: true, started_pid: child.pid ?? null, script: DAEMON_SCRIPT };
  });
}
