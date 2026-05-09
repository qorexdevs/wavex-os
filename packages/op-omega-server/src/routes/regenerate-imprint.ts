/** Regenerate-imprint route. Lets the operator re-run the T2 imprint
 *  generation with optional free-form guidance ("remove name references",
 *  "focus more on the international distribution motion", etc.) AFTER the
 *  initial finalize landed. Updates the company.manifest.{json,yaml} on
 *  disk in place + returns the new sha256.
 *
 *  Flow:
 *    1. Load company.manifest.json from disk
 *    2. Re-run generateImprintReview with operatorGuidance
 *    3. Splice the new imprint_summary into the manifest
 *    4. Re-compute sha256 + write back
 *    5. Return { ok, manifest, sha256, source } */

import { z } from "zod";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import yaml from "js-yaml";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  generateImprintReview, computeManifestHash,
  type CompanyManifest,
} from "@op-omega/plugin-onboarding";
import { assertBoard, assertCompanyAccess, AuthError } from "@wavex-os/auth-shim";
import { getOnboardingDir } from "../state-bridge.js";

const schema = z.object({
  companyId: z.string().min(1),
  operatorGuidance: z.string().min(1).max(2000).optional(),
});

function authReq(req: FastifyRequest) {
  return { method: req.method, headers: req.headers as Record<string, string> };
}

export function registerRegenerateImprintRoute(app: FastifyInstance): void {
  app.post("/op-omega/onboarding/regenerate-imprint", async (req: FastifyRequest, reply: FastifyReply) => {
    const ar = authReq(req);
    try { assertBoard(ar); } catch (e) {
      if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
      throw e;
    }
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ ok: false, error: "validation failed", issues: parsed.error.issues });
    assertCompanyAccess(ar, parsed.data.companyId);

    const dir = getOnboardingDir(parsed.data.companyId);
    const manifestPath = join(dir, "company.manifest.json");

    let manifest: CompanyManifest;
    try {
      manifest = JSON.parse(await readFile(manifestPath, "utf8")) as CompanyManifest;
    } catch (e) {
      return reply.status(404).send({
        ok: false,
        error: `company.manifest.json not found for ${parsed.data.companyId}. Finalize first.`,
      });
    }

    let imprint;
    try {
      imprint = await generateImprintReview({
        companyId: parsed.data.companyId,
        responses: manifest.pillar_responses,
        connectors: manifest.connector_manifest,
        swarm: manifest.swarm_manifest,
        workflows: manifest.workflow_manifest,
        mcWinner: manifest.mc_winner,
        operatorGuidance: parsed.data.operatorGuidance,
      });
    } catch (e) {
      return reply.status(503).send({
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }

    // Splice + re-sign
    const updated: CompanyManifest = {
      ...manifest,
      imprint_summary: imprint.summary,
      finalized_at: new Date().toISOString(),
    };

    // Manifest hash with signatures field zeroed out (per the canonical-hash
    // contract in computeManifestHash). We then write the hash into signatures
    // and persist.
    const newHash = computeManifestHash(updated);
    updated.signatures = {
      ...updated.signatures,
      manifest_hash: newHash,
    };

    await writeFile(manifestPath, JSON.stringify(updated, null, 2), "utf8");
    await writeFile(join(dir, "company.manifest.yaml"), yaml.dump(updated), "utf8");

    return {
      ok: true,
      manifest: updated,
      sha256: newHash,
      source: imprint.source,
      warnings: imprint.warnings,
    };
  });
}
