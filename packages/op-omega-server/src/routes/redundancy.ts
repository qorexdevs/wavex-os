/** Redundancy review routes — surface exact-templateId duplicate groups
 *  and let the operator mute slots they decide are redundant.
 *
 *  GET  /api/instance/:companyId/redundancy
 *      → { groups: RedundancyGroup[], all_slots: ResolvedSlot[], mutes: string[] }
 *  POST /api/instance/:companyId/mute-slot   { slot: string }
 *  DELETE /api/instance/:companyId/mute-slot { slot: string }
 *
 *  Mutes live on the manifest as `template_mutes: string[]`; the bridge
 *  skips them when writing agents to DB. Reset clears them with the rest
 *  of the company state. */

import { z } from "zod";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import yaml from "js-yaml";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { computeManifestHash, type CompanyManifest } from "@op-omega/plugin-onboarding";
import { assertBoard, assertCompanyAccess, AuthError } from "@wavex-os/auth-shim";
import { getOnboardingDir } from "../state-bridge.js";
import { detectRedundancy, resolveAllSlots } from "../lib/redundancy.js";

interface ManifestExt extends CompanyManifest {
  template_overlays?: Record<string, string>;
  template_additions?: Array<{ slot: string; parent_slot: string; template_id: string; added_at: string }>;
  template_mutes?: string[];
}

const muteBody = z.object({ slot: z.string().min(1) });

function authReq(req: FastifyRequest) {
  return { method: req.method, headers: req.headers as Record<string, string> };
}

async function loadManifest(companyId: string): Promise<ManifestExt | null> {
  try {
    const raw = await readFile(join(getOnboardingDir(companyId), "company.manifest.json"), "utf8");
    return JSON.parse(raw) as ManifestExt;
  } catch {
    return null;
  }
}

async function writeManifest(companyId: string, m: ManifestExt): Promise<void> {
  const dir = getOnboardingDir(companyId);
  await writeFile(join(dir, "company.manifest.json"), JSON.stringify(m, null, 2), "utf8");
  await writeFile(join(dir, "company.manifest.yaml"), yaml.dump(m), "utf8");
}

export function registerRedundancyRoutes(app: FastifyInstance): void {
  app.get("/api/instance/:companyId/redundancy", async (req, reply) => {
    const ar = authReq(req);
    try { assertBoard(ar); } catch (e) {
      if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
      throw e;
    }
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(ar, companyId);

    const manifest = await loadManifest(companyId);
    if (!manifest) return reply.status(404).send({ ok: false, error: "manifest not found — finalize first" });

    return {
      ok: true,
      groups: detectRedundancy(manifest),
      all_slots: resolveAllSlots(manifest),
      mutes: manifest.template_mutes ?? [],
    };
  });

  async function setMute(companyId: string, slot: string, mute: boolean): Promise<{
    ok: true; mutes: string[]; sha256: string;
  } | { ok: false; status: number; error: string }> {
    const manifest = await loadManifest(companyId);
    if (!manifest) return { ok: false, status: 404, error: "manifest not found — finalize first" };

    const mutes = new Set(manifest.template_mutes ?? []);
    // Validate the slot is a real one (base roster OR an addition).
    const inBase = !!manifest.swarm_manifest.agents[slot];
    const inAdditions = (manifest.template_additions ?? []).some((a) => a.slot === slot);
    if (!inBase && !inAdditions) {
      return { ok: false, status: 400, error: `slot "${slot}" is not in the swarm manifest or operator additions` };
    }
    if (mute) mutes.add(slot); else mutes.delete(slot);
    manifest.template_mutes = [...mutes].sort();
    manifest.finalized_at = new Date().toISOString();
    const newHash = computeManifestHash(manifest);
    manifest.signatures = { ...manifest.signatures, manifest_hash: newHash };
    await writeManifest(companyId, manifest);
    return { ok: true, mutes: manifest.template_mutes, sha256: newHash };
  }

  app.post("/api/instance/:companyId/mute-slot", async (req, reply) => {
    const ar = authReq(req);
    try { assertBoard(ar); } catch (e) {
      if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
      throw e;
    }
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(ar, companyId);
    const parsed = muteBody.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ ok: false, error: "validation failed", issues: parsed.error.issues });
    const result = await setMute(companyId, parsed.data.slot, true);
    if (!result.ok) return reply.status(result.status).send(result);
    return result;
  });

  app.delete("/api/instance/:companyId/mute-slot", async (req, reply) => {
    const ar = authReq(req);
    try { assertBoard(ar); } catch (e) {
      if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
      throw e;
    }
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(ar, companyId);
    const parsed = muteBody.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ ok: false, error: "validation failed", issues: parsed.error.issues });
    const result = await setMute(companyId, parsed.data.slot, false);
    if (!result.ok) return reply.status(result.status).send(result);
    return result;
  });
}
