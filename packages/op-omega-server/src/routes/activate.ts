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
import { ignite } from "../bridge/ignition.js";

function authReq(req: FastifyRequest) {
  return { method: req.method, headers: req.headers as Record<string, string> };
}

let migrationsRun = false;
async function ensureMigrations(): Promise<void> {
  if (migrationsRun) return;
  await runMigrations();
  migrationsRun = true;
}

/** Best-effort Telegram alert when a company activates but ignition leaves
 *  it planning-orphaned. The operator MUST know — the fleet looks live but
 *  has no goal / roadmap / kickoff, so the agents wake with nothing to
 *  drive. This used to slip by as a soft "deferred" status. Never throws. */
async function alertIgnitionOrphaned(companyId: string, detail: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN ?? process.env.WAVEX_OPS_TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID ?? process.env.WAVEX_OPS_TELEGRAM_CHAT_ID;
  if (!token || !chat) return;
  const text = [
    `⚠️ *WaveX — ignition orphaned*`,
    `Company \`${companyId}\` activated and agents were hired — but ignition did not plan it.`,
    `The fleet has no goal / roadmap / kickoff. Detail: ${detail}`,
    `Re-run planning: POST /api/instance/${companyId}/ignite`,
  ].join("\n");
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chat,
      text,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    }),
  });
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

      // Phase G — Ignition. Does NOT fail activate (the agents are hired
      // and recoverable) — but a failed/deferred ignition leaves the fleet
      // ORPHAN FROM PLANNING: no goal object, no seeded roadmap, no
      // kickoff. That used to slip by silently as a soft "deferred". It
      // must not. See docs/IGNITION.md.
      const ignition = await ignite(manifest, companyId, handoff).catch((e) => ({
        status: "deferred" as const,
        agents_working: 0,
        workflows_queued: 0,
        goal_id: null,
        errors: [{ step: "<bootstrap>", message: e instanceof Error ? e.message : String(e), ts: new Date().toISOString() }],
        warnings: [],
        ignition_state_path: "",
      }));

      // A planned fleet HAS a goal object. No goal_id (or any errors) means
      // the company is planning-orphaned — surface it LOUDLY, never silently.
      const ignitionOrphaned =
        !ignition.goal_id || (ignition.errors?.length ?? 0) > 0;
      if (ignitionOrphaned) {
        const detail =
          (ignition.errors ?? []).map((er) => `${er.step}: ${er.message}`).join("; ") ||
          "ignition produced no goal object";
        console.error(
          `[activate] IGNITION ORPHANED — company ${companyId}: agents hired but the fleet is unplanned. ${detail}`,
        );
        await alertIgnitionOrphaned(companyId, detail).catch(() => {});
      }

      return {
        ok: true,
        inserted: { companies: result.companies, agents: result.agents },
        warnings: result.warnings,
        sha256: newHash,
        paperclipHandoff: handoff,
        ignition,
        ignition_orphaned: ignitionOrphaned,
      };
    } catch (e) {
      return reply.status(500).send({
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  });

  // Standalone re-ignite endpoint for partial-recovery: operator clicks
  // "Ignite Fleet" in Mission Control when a prior activate's ignition
  // step deferred/failed and they want to retry.
  app.post("/api/instance/:companyId/ignite", async (req, reply) => {
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
      return reply.status(404).send({ ok: false, error: "manifest not found" });
    }

    // Re-discover handoff state. The activate step persists it in the
    // paperclip-handoff.json file; in a future commit we'll read it from
    // there. For now we re-run handoff (idempotent).
    const handoff = await handoffToPaperclip(manifest, companyId).catch((e) => ({
      enabled: true,
      paperclipUrl: process.env.PAPERCLIP_HANDOFF_URL ?? null,
      paperclipCompanyId: null,
      created: [],
      skipped: [],
      errors: [{ slot: "<bootstrap>", message: e instanceof Error ? e.message : String(e) }],
    }));

    const ignition = await ignite(manifest, companyId, handoff);
    return reply.send({ ok: true, ignition });
  });
}
