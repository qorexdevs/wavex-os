/** Instance read endpoints for the dashboard. Surface the finalized
 *  company.manifest.json + per-company KPI registry derived from it. */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { assertBoard, assertCompanyAccess, AuthError } from "@wavex-os/auth-shim";
import { getOnboardingDir, getInstanceDir } from "../state-bridge.js";

function authReq(req: FastifyRequest) {
  return { method: req.method, headers: req.headers as Record<string, string> };
}

interface ManifestShape {
  company?: { id?: string; name?: string };
  goal?: { kpiId?: string; current?: number; target?: number; days?: number };
  swarm_manifest?: {
    agents?: Record<string, {
      status?: string;
      role?: string;
      template_id?: string;
      reports_to_slot?: string | null;
      owned_kpi_ids?: string[];
    }>;
  };
  workflow_manifest?: { workflows?: unknown[]; routines?: unknown[] };
  state?: string;
  pillars?: Record<string, unknown>;
}

async function loadCompanyManifest(companyId: string): Promise<ManifestShape | null> {
  try {
    const path = join(getOnboardingDir(companyId), "company.manifest.json");
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as ManifestShape;
  } catch {
    return null;
  }
}

export function registerInstanceRoutes(app: FastifyInstance): void {
  app.get("/api/instance/:companyId/manifest", async (req, reply) => {
    const ar = authReq(req);
    try { assertBoard(ar); } catch (e) {
      if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
      throw e;
    }
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(ar, companyId);
    const manifest = await loadCompanyManifest(companyId);
    if (!manifest) return reply.status(404).send({ error: "manifest not found", companyId });
    return { ok: true, manifest };
  });

  app.get("/api/instance/:companyId/kpis", async (req, reply) => {
    const ar = authReq(req);
    try { assertBoard(ar); } catch (e) {
      if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
      throw e;
    }
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(ar, companyId);
    const manifest = await loadCompanyManifest(companyId);
    if (!manifest) return reply.status(404).send({ error: "manifest not found", companyId });

    // Build wavex KPI registry from the manifest's goal + swarm-owned KPIs.
    const kpis: Array<{
      kpiId: string;
      label: string;
      direction: "higher_is_better" | "lower_is_better";
      ownerRole?: string;
      currentValue?: number;
      targetMicros?: number;
      windowDays?: number;
    }> = [];

    if (manifest.goal?.kpiId) {
      kpis.push({
        kpiId: manifest.goal.kpiId,
        label: manifest.goal.kpiId.replace(/_/g, " "),
        direction: "higher_is_better",
        ownerRole: "ceo",
        currentValue: manifest.goal.current,
        targetMicros: manifest.goal.target ? manifest.goal.target * 1_000_000 : undefined,
        windowDays: manifest.goal.days,
      });
    }
    const seen = new Set<string>(kpis.map((k) => k.kpiId));
    const agents = manifest.swarm_manifest?.agents ?? {};
    for (const [slot, agent] of Object.entries(agents)) {
      for (const kpi of agent.owned_kpi_ids ?? []) {
        if (seen.has(kpi)) continue;
        seen.add(kpi);
        kpis.push({
          kpiId: kpi,
          label: kpi.replace(/_/g, " "),
          direction: kpi.includes("rate") || kpi.includes("burn") ? "lower_is_better" : "higher_is_better",
          ownerRole: agent.role ?? slot,
        });
      }
    }
    return { ok: true, companyId, kpis };
  });

  app.get("/api/companies", async (req, reply) => {
    const ar = authReq(req);
    try { assertBoard(ar); } catch (e) {
      if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
      throw e;
    }
    // Enumerate companies by reading the wavex instances directory.
    try {
      const fs = await import("node:fs/promises");
      const root = join(getInstanceDir(""), "..");
      const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
      const companies = entries
        .filter((e) => e.isDirectory() && e.name !== "default")
        .map((e) => ({ id: e.name, name: e.name }));
      // Plus any company under the plugin's session layout
      const pluginRoot = join(getInstanceDir(""), "..", "default", "companies");
      const pluginEntries = await fs.readdir(pluginRoot, { withFileTypes: true }).catch(() => []);
      for (const e of pluginEntries) {
        if (!e.isDirectory()) continue;
        if (companies.find((c) => c.id === e.name)) continue;
        companies.push({ id: e.name, name: e.name });
      }
      return { ok: true, companies };
    } catch (e) {
      return reply.status(500).send({ error: "failed to enumerate companies" });
    }
  });
}
