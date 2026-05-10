/** POST /api/instance/:companyId/add-agent
 *
 *  Adds a new agent under an existing parent slot. Persists to
 *  manifest.template_additions[] (a separate field from operator overlays
 *  so additions and substitutions stay distinguishable in the audit trail).
 *  Bridge merges these into the agents-table writes on activate.
 *
 *  Body: { parent_slot, template_id, slot_suffix? }
 *    - parent_slot: must exist in swarm_manifest.agents
 *    - template_id: any registered templateId
 *    - slot_suffix: optional explicit suffix (e.g. "viral-loop"). If absent,
 *      derived from template_id with collision avoidance. Final slot is
 *      `${parent_slot}.${suffix}`.
 *
 *  DELETE same path with body { slot } removes a previously added agent. */

import { z } from "zod";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import yaml from "js-yaml";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { computeManifestHash, type CompanyManifest } from "@op-omega/plugin-onboarding";
import { assertBoard, assertCompanyAccess, AuthError } from "@wavex-os/auth-shim";
import { getOnboardingDir } from "../state-bridge.js";

const addSchema = z.object({
  parent_slot: z.string().min(1),
  template_id: z.string().min(1).max(80),
  slot_suffix: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/i).optional(),
});

const removeSchema = z.object({
  slot: z.string().min(1),
});

export interface AddedAgent {
  slot: string;
  parent_slot: string;
  template_id: string;
  added_at: string;
}

interface ManifestWithAdditions extends CompanyManifest {
  template_overlays?: Record<string, string>;
  template_additions?: AddedAgent[];
}

function authReq(req: FastifyRequest) {
  return { method: req.method, headers: req.headers as Record<string, string> };
}

async function loadManifest(companyId: string): Promise<ManifestWithAdditions | null> {
  try {
    const path = join(getOnboardingDir(companyId), "company.manifest.json");
    return JSON.parse(await readFile(path, "utf8")) as ManifestWithAdditions;
  } catch { return null; }
}

async function writeManifest(companyId: string, m: ManifestWithAdditions): Promise<void> {
  const dir = getOnboardingDir(companyId);
  await writeFile(join(dir, "company.manifest.json"), JSON.stringify(m, null, 2), "utf8");
  await writeFile(join(dir, "company.manifest.yaml"), yaml.dump(m), "utf8");
}

/** Slugify a template_id into a slot suffix. "growth-hacker" → "growth-hacker". */
function deriveSuffix(templateId: string): string {
  return templateId.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Build a unique slot under parent that doesn't collide with the base
 *  roster, prior overlays, or prior additions. */
function uniqueSlot(parentSlot: string, baseSuffix: string, existing: Set<string>): string {
  let candidate = `${parentSlot}.${baseSuffix}`;
  let n = 2;
  while (existing.has(candidate)) {
    candidate = `${parentSlot}.${baseSuffix}-${n}`;
    n++;
  }
  return candidate;
}

export function registerAddAgentRoute(app: FastifyInstance): void {
  app.post("/api/instance/:companyId/add-agent", async (req, reply) => {
    const ar = authReq(req);
    try { assertBoard(ar); } catch (e) {
      if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
      throw e;
    }
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(ar, companyId);

    const parsed = addSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ ok: false, error: "validation failed", issues: parsed.error.issues });
    const { parent_slot, template_id, slot_suffix } = parsed.data;

    const manifest = await loadManifest(companyId);
    if (!manifest) return reply.status(404).send({ ok: false, error: "manifest not found — finalize first" });

    if (!manifest.swarm_manifest.agents[parent_slot]) {
      return reply.status(400).send({ ok: false, error: `parent slot "${parent_slot}" not in swarm manifest` });
    }

    manifest.template_additions = manifest.template_additions ?? [];

    // Build set of all currently used slot names (base + additions)
    const used = new Set<string>([
      ...Object.keys(manifest.swarm_manifest.agents),
      ...manifest.template_additions.map((a) => a.slot),
    ]);

    const suffix = slot_suffix ?? deriveSuffix(template_id);
    const newSlot = uniqueSlot(parent_slot, suffix, used);

    const added: AddedAgent = {
      slot: newSlot,
      parent_slot,
      template_id,
      added_at: new Date().toISOString(),
    };
    manifest.template_additions.push(added);

    // Re-sign so the audit trail captures the addition
    manifest.finalized_at = new Date().toISOString();
    const newHash = computeManifestHash(manifest);
    manifest.signatures = { ...manifest.signatures, manifest_hash: newHash };
    await writeManifest(companyId, manifest);

    return {
      ok: true,
      added,
      additions: manifest.template_additions,
      sha256: newHash,
    };
  });

  app.delete("/api/instance/:companyId/add-agent", async (req, reply) => {
    const ar = authReq(req);
    try { assertBoard(ar); } catch (e) {
      if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
      throw e;
    }
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(ar, companyId);

    const parsed = removeSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ ok: false, error: "validation failed", issues: parsed.error.issues });

    const manifest = await loadManifest(companyId);
    if (!manifest) return reply.status(404).send({ ok: false, error: "manifest not found" });
    const before = manifest.template_additions?.length ?? 0;
    manifest.template_additions = (manifest.template_additions ?? []).filter((a) => a.slot !== parsed.data.slot);
    const after = manifest.template_additions.length;
    if (before === after) return reply.status(404).send({ ok: false, error: `addition for slot "${parsed.data.slot}" not found` });

    manifest.finalized_at = new Date().toISOString();
    const newHash = computeManifestHash(manifest);
    manifest.signatures = { ...manifest.signatures, manifest_hash: newHash };
    await writeManifest(companyId, manifest);

    return { ok: true, removed_slot: parsed.data.slot, additions: manifest.template_additions, sha256: newHash };
  });
}
