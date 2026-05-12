/** POST /api/instance/:companyId/activate
 *
 *  Loads the signed company.manifest.json from disk and runs `bridgeAgents`
 *  to materialize the swarm topology + companies row into the wavex DB.
 *  This is the seam where wizard output becomes runtime state.
 *
 *  Idempotent: re-calling against the same companyId after a refinement
 *  upserts cleanly (deterministic agent ids). */

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import yaml from "js-yaml";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { computeManifestHash, type CompanyManifest } from "@op-omega/plugin-onboarding";
import { assertBoard, assertCompanyAccess, AuthError } from "@wavex-os/auth-shim";
import { getDb, runMigrations } from "@wavex-os/db";
import { getOnboardingDir } from "../state-bridge.js";
import { bridgeAgents } from "../bridge/finalize-bridge.js";
import { handoffToPaperclip } from "../bridge/paperclip-handoff.js";

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
  // GET /api/instance/:companyId/handoff-status — polled by ActivateProgress
  // during /activate so the UI can paint per-slot hires in real time.
  // Returns the current handoff-progress.json (written by paperclip-handoff.ts
  // after each hire) or null when no handoff is in flight / complete.
  app.get("/api/instance/:companyId/handoff-status", async (req, reply) => {
    const ar = authReq(req);
    try { assertBoard(ar); } catch (e) {
      if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
      throw e;
    }
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(ar, companyId);
    try {
      const path = join(getOnboardingDir(companyId), "..", "handoff-progress.json");
      const raw = await readFile(path, "utf8");
      return { ok: true, progress: JSON.parse(raw) };
    } catch {
      return { ok: true, progress: null };
    }
  });

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

      // bridgeAgents mutated the manifest with template_selections (rationale
      // for each matrix pick). Persist back to disk + re-sign so the dashboard
      // can surface it and the audit trail is honest about the matrix's choices.
      const dir = getOnboardingDir(companyId);
      const newHash = computeManifestHash(manifest);
      manifest.signatures = { ...manifest.signatures, manifest_hash: newHash };
      await writeFile(join(dir, "company.manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
      await writeFile(join(dir, "company.manifest.yaml"), yaml.dump(manifest), "utf8");

      // Phase D — opt-in handoff to a running Paperclip instance. When
      // PAPERCLIP_HANDOFF_URL is set, the C-Suite is mirrored as real
      // Paperclip agents so they get heartbeats + claude CLI execution.
      // When unset, this is a no-op and bridgeAgents-only is the contract.
      //
      // Re-run auto-detection on each activate — if Paperclip wasn't running
      // when wavex booted but is up now, detection picks it up here and the
      // handoff fires. Self-heals without requiring a wavex restart.
      const { detectAndConfigurePaperclip } = await import("../lib/paperclip-detect.js");
      await detectAndConfigurePaperclip();
      const handoff = await handoffToPaperclip(manifest, companyId).catch((e) => ({
        enabled: true,
        paperclipUrl: process.env.PAPERCLIP_HANDOFF_URL ?? null,
        paperclipCompanyId: null,
        created: [],
        skipped: [],
        errors: [{ slot: "<bootstrap>", message: e instanceof Error ? e.message : String(e) }],
      }));

      return {
        ok: true,
        inserted: { companies: result.companies, agents: result.agents },
        warnings: result.warnings,
        sha256: newHash,
        paperclipHandoff: handoff,
      };
    } catch (e) {
      return reply.status(500).send({
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  });
}
