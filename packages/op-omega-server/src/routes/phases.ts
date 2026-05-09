/** Phase generators (Connector / Swarm / Workflow) + finalize routes. */

import { z } from "zod";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  generateConnectorManifest,
  generateSwarmManifest,
  generateWorkflowManifest,
  loadConnectorManifest, loadSwarmManifest, loadPillarResponses,
  assembleCompanyManifest,
  computeManifestHash,
  isOnboardingHaltError,
  invokeMonteCarlo,
  type WorkflowManifest,
} from "@op-omega/plugin-onboarding";
import { listConnections } from "@wavex-os/composio-shim";
import { assertBoard, assertCompanyAccess, AuthError } from "@wavex-os/auth-shim";

const generateConnectorSchema = z.object({
  companyId: z.string().min(1),
  skipInference: z.boolean().optional(),
});

const generateSwarmSchema = z.object({
  companyId: z.string().min(1),
  skipInference: z.boolean().optional(),
});

const generateWorkflowSchema = z.object({
  companyId: z.string().min(1),
  skipInference: z.boolean().optional(),
  bypassBudgetCheck: z.boolean().optional(),
});

const completeSchema = z.object({
  companyId: z.string().min(1),
  orgId: z.string().min(1).max(80).optional(),
  operatorHandle: z.string().max(120).optional(),
  skipInference: z.boolean().optional(),
  mc: z.object({
    horizon_cycles: z.number().int().positive().max(120).optional(),
    n_runs: z.number().int().positive().max(100).optional(),
    seed: z.number().int().optional(),
  }).optional(),
});

function authReq(req: FastifyRequest) {
  return { method: req.method, headers: req.headers as Record<string, string> };
}

function bodyError(reply: FastifyReply, e: unknown) {
  if (isOnboardingHaltError(e)) {
    return reply.status(409).send({ ok: false, halt: e.toJSON() });
  }
  throw e;
}

function gateBoard(req: FastifyRequest, reply: FastifyReply): boolean {
  const ar = authReq(req);
  try { assertBoard(ar); return true; }
  catch (e) {
    if (e instanceof AuthError) { reply.status(e.statusCode).send({ error: e.message }); return false; }
    throw e;
  }
}

export function registerPhaseRoutes(app: FastifyInstance): void {
  app.get("/op-omega/onboarding/connector-recommendations", async (req, reply) => {
    if (!gateBoard(req, reply)) return;
    const { companyId } = (req.query ?? {}) as { companyId?: string };
    if (!companyId) return reply.status(400).send({ error: "companyId required" });
    assertCompanyAccess(authReq(req), companyId);
    const responses = await loadPillarResponses(companyId).catch(() => null);
    if (!responses) return reply.status(404).send({ error: "no pillar responses yet" });
    const live = await listConnections(companyId);
    try {
      const result = await generateConnectorManifest({
        companyId, responses, skipInference: true, liveConnections: live,
      });
      return { ok: true, manifest: result.manifest, source: result.source, warnings: result.warnings };
    } catch (e) {
      return bodyError(reply, e);
    }
  });

  app.post("/op-omega/onboarding/connector-manifest", async (req, reply) => {
    if (!gateBoard(req, reply)) return;
    const parsed = generateConnectorSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "validation failed", issues: parsed.error.issues });
    assertCompanyAccess(authReq(req), parsed.data.companyId);
    const responses = await loadPillarResponses(parsed.data.companyId).catch(() => null);
    if (!responses) return reply.status(404).send({ error: "no pillar responses" });
    const live = await listConnections(parsed.data.companyId);
    try {
      const result = await generateConnectorManifest({
        companyId: parsed.data.companyId,
        responses,
        skipInference: parsed.data.skipInference,
        liveConnections: live,
      });
      return { ok: true, manifest: result.manifest, source: result.source, warnings: result.warnings };
    } catch (e) {
      return bodyError(reply, e);
    }
  });

  app.post("/op-omega/onboarding/swarm-manifest", async (req, reply) => {
    if (!gateBoard(req, reply)) return;
    const parsed = generateSwarmSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "validation failed", issues: parsed.error.issues });
    assertCompanyAccess(authReq(req), parsed.data.companyId);
    const connector = await loadConnectorManifest(parsed.data.companyId).catch(() => null);
    if (!connector) return reply.status(409).send({ error: "connector manifest not generated" });
    const responses = await loadPillarResponses(parsed.data.companyId);
    try {
      const result = await generateSwarmManifest({
        companyId: parsed.data.companyId,
        responses,
        connectorManifest: connector,
        skipInference: parsed.data.skipInference,
      });
      return { ok: true, manifest: result.manifest, source: result.source, warnings: result.warnings };
    } catch (e) {
      return bodyError(reply, e);
    }
  });

  app.post("/op-omega/onboarding/workflow-manifest", async (req, reply) => {
    if (!gateBoard(req, reply)) return;
    const parsed = generateWorkflowSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "validation failed", issues: parsed.error.issues });
    assertCompanyAccess(authReq(req), parsed.data.companyId);
    const connector = await loadConnectorManifest(parsed.data.companyId).catch(() => null);
    if (!connector) return reply.status(409).send({ error: "connector manifest not generated" });
    const swarm = await loadSwarmManifest(parsed.data.companyId).catch(() => null);
    if (!swarm) return reply.status(409).send({ error: "swarm manifest not generated" });
    const responses = await loadPillarResponses(parsed.data.companyId);
    try {
      const result = await generateWorkflowManifest({
        companyId: parsed.data.companyId,
        responses,
        connectorManifest: connector,
        swarmManifest: swarm,
        skipInference: parsed.data.skipInference,
        bypassBudgetCheck: parsed.data.bypassBudgetCheck,
      });
      return { ok: true, manifest: result.manifest, source: result.source, warnings: result.warnings };
    } catch (e) {
      return bodyError(reply, e);
    }
  });

  app.post("/op-omega/onboarding/finalize", async (req, reply) => {
    if (!gateBoard(req, reply)) return;
    const parsed = completeSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "validation failed", issues: parsed.error.issues });
    assertCompanyAccess(authReq(req), parsed.data.companyId);

    const responses = await loadPillarResponses(parsed.data.companyId);
    const connector = await loadConnectorManifest(parsed.data.companyId).catch(() => null);
    const swarm = await loadSwarmManifest(parsed.data.companyId).catch(() => null);
    if (!connector || !swarm) {
      return reply.status(409).send({ error: "connector and swarm manifests required before finalize" });
    }

    // Workflow manifest is required by assembleCompanyManifest; regenerate
    // deterministically from current responses + manifests so finalize is
    // single-call from the UI's perspective.
    let workflow: WorkflowManifest;
    try {
      const wf = await generateWorkflowManifest({
        companyId: parsed.data.companyId,
        responses, connectorManifest: connector, swarmManifest: swarm,
        skipInference: true, bypassBudgetCheck: true,
      });
      workflow = wf.manifest;
    } catch (e) {
      return bodyError(reply, e);
    }

    try {
      const result = await assembleCompanyManifest({
        companyId: parsed.data.companyId,
        orgId: parsed.data.orgId ?? parsed.data.companyId,
        responses,
        connectorManifest: connector,
        swarmManifest: swarm,
        workflowManifest: workflow,
        skipInference: parsed.data.skipInference,
        mc: parsed.data.mc,
      });
      return {
        ok: true,
        manifest: result.manifest,
        sha256: computeManifestHash(result.manifest),
        source: result.source,
        warnings: result.warnings,
      };
    } catch (e) {
      return bodyError(reply, e);
    }
  });
}
