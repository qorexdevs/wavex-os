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

    // Build wavex KPI registry from upstream sources:
    //   1. kpi_snapshot_initial — 12 baseline measurements from Pillar 3
    //   2. mc_winner.mean_mrr_growth — MC projection (when present)
    //   3. swarm topology — agent counts as system KPIs
    type KpiRow = {
      kpiId: string;
      label: string;
      direction: "higher_is_better" | "lower_is_better";
      ownerRole?: string;
      currentValue?: number;
      targetMicros?: number;
      windowDays?: number;
    };
    const kpis: KpiRow[] = [];

    // Headline KPI: MRR (from kpi_snapshot_initial)
    const snap = (manifest as { pillar_responses?: { pillar_3?: { kpi_snapshot_initial?: Record<string, number> } } })
      .pillar_responses?.pillar_3?.kpi_snapshot_initial;
    if (snap) {
      const KPI_DEFS: Array<{ id: keyof typeof snap; label: string; dir: "higher_is_better" | "lower_is_better"; owner: string }> = [
        { id: "mrr", label: "Monthly Recurring Revenue", dir: "higher_is_better", owner: "ceo" },
        { id: "nrr", label: "Net Revenue Retention", dir: "higher_is_better", owner: "cro" },
        { id: "grr", label: "Gross Revenue Retention", dir: "higher_is_better", owner: "cro" },
        { id: "burn_multiple", label: "Burn Multiple", dir: "lower_is_better", owner: "cfo" },
        { id: "cac_payback_months", label: "CAC Payback (months)", dir: "lower_is_better", owner: "cfo" },
        { id: "ltv_cac_ratio", label: "LTV / CAC Ratio", dir: "higher_is_better", owner: "cfo" },
        { id: "activation_rate", label: "Activation Rate", dir: "higher_is_better", owner: "cpo" },
        { id: "win_rate", label: "Win Rate", dir: "higher_is_better", owner: "cro" },
        { id: "sales_cycle_days", label: "Sales Cycle (days)", dir: "lower_is_better", owner: "cro" },
        { id: "narrative_strength", label: "Narrative Strength", dir: "higher_is_better", owner: "cmo" },
      ];
      for (const k of KPI_DEFS) {
        const v = snap[k.id];
        if (v == null) continue;
        kpis.push({
          kpiId: String(k.id),
          label: k.label,
          direction: k.dir,
          ownerRole: k.owner,
          currentValue: v,
        });
      }
    }

    // System KPI: MC projected mean MRR growth (when finalize ran with MC)
    const mc = (manifest as { mc_winner?: { mean_mrr_growth?: number; strategy_id?: string } }).mc_winner;
    if (mc?.mean_mrr_growth != null) {
      kpis.push({
        kpiId: "mc_projected_mrr_growth",
        label: `Projected MRR growth (${mc.strategy_id ?? "MC winner"})`,
        direction: "higher_is_better",
        ownerRole: "ceo",
        currentValue: mc.mean_mrr_growth,
      });
    }

    return { ok: true, companyId, kpis };
  });

  app.get("/api/companies", async (req, reply) => {
    const ar = authReq(req);
    try { assertBoard(ar); } catch (e) {
      if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
      throw e;
    }
    // Enumerate companies from the plugin's session layout:
    //   ~/.wavex-os/instances/default/companies/<companyId>/onboarding/
    try {
      const fs = await import("node:fs/promises");
      const companiesRoot = join(getInstanceDir(""), "default", "companies");
      const entries = await fs.readdir(companiesRoot, { withFileTypes: true }).catch(() => []);
      const companies = entries
        .filter((e) => e.isDirectory())
        .map((e) => ({ id: e.name, name: e.name }));
      return { ok: true, companies };
    } catch (e) {
      return reply.status(500).send({ error: "failed to enumerate companies" });
    }
  });

  // Post-activate handoff state — read by InceptionCTA on Mission Control to
  // decide whether to show "Open Paperclip Dashboard" with a real link vs
  // the generic "fleet is live, defaults to localhost:5174" fallback.
  // The handoff JSON is written by bridge/paperclip-handoff.ts when activate
  // successfully posts the manifest to a Paperclip backend; absent it,
  // either Paperclip wasn't configured (PAPERCLIP_HANDOFF_URL empty) or the
  // customer ran with mock-core only.
  app.get("/api/instance/:companyId/handoff", async (req, reply) => {
    const ar = authReq(req);
    try { assertBoard(ar); } catch (e) {
      if (e instanceof AuthError) return reply.status(e.statusCode).send({ error: e.message });
      throw e;
    }
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(ar, companyId);
    try {
      const path = join(getOnboardingDir(companyId), "..", "paperclip-handoff.json");
      const raw = await readFile(path, "utf8");
      const j = JSON.parse(raw) as {
        paperclipUrl?: string;
        paperclipCompanyId?: string;
        handedOffAt?: string;
      };
      return {
        ok: true,
        handoff: {
          paperclipUrl: j.paperclipUrl ?? null,
          paperclipCompanyId: j.paperclipCompanyId ?? null,
          handedOff: Boolean(j.paperclipUrl && j.paperclipCompanyId),
        },
      };
    } catch {
      // No handoff file → fleet is local-only (mock-core / unconfigured
      // Paperclip). CTA degrades to the generic "live on localhost" message.
      return { ok: true, handoff: { paperclipUrl: null, paperclipCompanyId: null, handedOff: false } };
    }
  });
}
