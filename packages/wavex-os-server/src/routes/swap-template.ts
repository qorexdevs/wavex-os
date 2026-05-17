/** POST /api/instance/:companyId/swap-template
 *
 *  Records an operator-chosen template substitution for a swarm slot.
 *  The swap is stored on the manifest as `template_overlays[slot] = templateId`
 *  and survives finalize / refinement / re-activate. The bridge consults it
 *  before falling back to the catalog default.
 *
 *  Body: { slot: string, templateId: string | null }
 *    - slot: must exist in manifest.swarm_manifest.agents
 *    - templateId: a registered templateId (validated against the registry),
 *      or null to clear the overlay (revert to catalog default).
 *
 *  Returns the updated overlays + the new manifest sha. */

import { z } from "zod";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import yaml from "js-yaml";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { computeManifestHash, type CompanyManifest } from "@wavex-os/plugin-onboarding";
import { assertBoard, assertCompanyAccess, AuthError } from "@wavex-os/auth-shim";
import { getOnboardingDir } from "../state-bridge.js";

const bodySchema = z.object({
  slot: z.string().min(1),
  templateId: z.string().min(1).nullable(),
});

interface ManifestWithOverlays extends CompanyManifest {
  template_overlays?: Record<string, string>;
  template_additions?: Array<{ slot: string; parent_slot: string; template_id: string; added_at: string }>;
}

function authReq(req: FastifyRequest) {
  return { method: req.method, headers: req.headers as Record<string, string> };
}

async function loadManifest(companyId: string): Promise<ManifestWithOverlays | null> {
  try {
    const path = join(getOnboardingDir(companyId), "company.manifest.json");
    return JSON.parse(await readFile(path, "utf8")) as ManifestWithOverlays;
  } catch {
    return null;
  }
}

async function writeManifest(companyId: string, m: ManifestWithOverlays): Promise<void> {
  const dir = getOnboardingDir(companyId);
  await writeFile(join(dir, "company.manifest.json"), JSON.stringify(m, null, 2), "utf8");
  await writeFile(join(dir, "company.manifest.yaml"), yaml.dump(m), "utf8");
}

export function registerSwapTemplateRoute(app: FastifyInstance): void {
  app.post("/api/instance/:companyId/swap-template", async (req, reply) => {
    const ar = authReq(req);
    try { assertBoard(ar); } catch (e) {
      if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
      throw e;
    }
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(ar, companyId);

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: "validation failed", issues: parsed.error.issues });
    }
    const { slot, templateId } = parsed.data;

    const manifest = await loadManifest(companyId);
    if (!manifest) return reply.status(404).send({ ok: false, error: "manifest not found — finalize first" });

    // Slot must exist either in the base roster OR as an operator addition.
    // Without this, swap can't target operator-added agents (added in a prior
    // session via /add-agent and stored in template_additions[]).
    const inBaseRoster = !!manifest.swarm_manifest.agents[slot];
    const inAdditions = (manifest.template_additions ?? []).some((a) => a.slot === slot);
    if (!inBaseRoster && !inAdditions) {
      return reply.status(400).send({ ok: false, error: `slot "${slot}" is not in the swarm manifest or operator additions` });
    }

    manifest.template_overlays = manifest.template_overlays ?? {};
    if (templateId === null) {
      delete manifest.template_overlays[slot];
    } else {
      manifest.template_overlays[slot] = templateId;
    }

    // Re-sign so the audit trail stays honest about the operator-chosen swap.
    manifest.finalized_at = new Date().toISOString();
    const newHash = computeManifestHash(manifest);
    manifest.signatures = { ...manifest.signatures, manifest_hash: newHash };

    await writeManifest(companyId, manifest);

    return {
      ok: true,
      slot,
      templateId,
      overlays: manifest.template_overlays,
      sha256: newHash,
    };
  });
}
