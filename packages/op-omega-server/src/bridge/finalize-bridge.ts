/** Finalize → DB bridge (Slice 1: agents only).
 *
 *  Translates a signed company.manifest.json into runtime DB state. Idempotent
 *  via deterministic agent ids + ON CONFLICT DO UPDATE. Slice 1 writes:
 *    - 1 row in `companies` (state flips to 'active')
 *    - N rows in `agents` (one per swarm_manifest.agents.* slot)
 *
 *  Out of scope (later slices): company_kpis, kpi_snapshots, cost_events,
 *  heartbeat_runs, issues, task_outcome_attributions, credentials sanity. */

import type { CompanyManifest } from "@op-omega/plugin-onboarding";
import { sql } from "drizzle-orm";
import { agents, companies, type Db } from "@wavex-os/db";
import {
  agentIdForSlot, modelForTier, slotToHumanName, templateIdForSlot, tierForSlot,
} from "./catalog.js";

interface ManifestWithOverlays extends CompanyManifest {
  template_overlays?: Record<string, string>;
}

export interface BridgeReport {
  companies: number;
  agents: number;
  warnings: string[];
}

export async function bridgeAgents(
  manifest: CompanyManifest,
  companyId: string,
  db: Db,
): Promise<BridgeReport> {
  const warnings: string[] = [];

  // 1. UPSERT companies
  await db.insert(companies).values({
    id: companyId,
    name: manifest.org_id || companyId,
    state: "active",
    pillarResponses: manifest.pillar_responses as unknown as Record<string, unknown>,
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: companies.id,
    set: {
      name: manifest.org_id || companyId,
      state: "active",
      pillarResponses: manifest.pillar_responses as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    },
  });

  // 2. UPSERT agents — pass 1: insert without reports_to_agent_id
  const slotEntries = Object.entries(manifest.swarm_manifest.agents);
  let warnedOnOwnedKpis = false;

  // Operator-chosen template substitutions take precedence over catalog defaults.
  const overlays = (manifest as ManifestWithOverlays).template_overlays ?? {};

  for (const [slot, entry] of slotEntries) {
    const tier = tierForSlot(slot);
    const overlayTemplate = overlays[slot];
    const templateId = overlayTemplate ?? templateIdForSlot(slot);
    if (templateId === slot && !slot.match(/^(ceo\.orchestrator|cpo|cmo|cro|cfo|cdo|coo)$/)) {
      warnings.push(`no template mapping for slot "${slot}" — using slot as templateId fallback`);
    }
    if (overlayTemplate) {
      warnings.push(`slot "${slot}" using operator-chosen overlay template "${overlayTemplate}" (default was "${templateIdForSlot(slot)}")`);
    }

    // owned_kpi_ids isn't on the upstream AgentManifestEntry type — defaults to []
    // until a later slice surfaces KPI ownership in the manifest. Warn once.
    if (!warnedOnOwnedKpis) {
      warnings.push("owned_kpi_ids defaulted to [] for all agents (manifest does not yet expose per-agent KPI ownership)");
      warnedOnOwnedKpis = true;
    }

    const role = slot.split(".")[0]!;

    await db.insert(agents).values({
      id: agentIdForSlot(companyId, slot),
      companyId,
      name: slotToHumanName(slot),
      role,
      slot,
      templateId,
      reportsToAgentId: null, // resolved in pass 2
      reportsToSlot: entry.reports_to,
      tier,
      status: entry.status,
      adapter: entry.adapter,
      model: modelForTier(tier),
      heartbeat: entry.heartbeat,
      spawnable: entry.spawnable,
      ownedKpiIds: [],
      spawnedAt: new Date(),
    }).onConflictDoUpdate({
      target: agents.id,
      set: {
        name: slotToHumanName(slot),
        role,
        templateId,
        reportsToSlot: entry.reports_to,
        tier,
        status: entry.status,
        adapter: entry.adapter,
        model: modelForTier(tier),
        heartbeat: entry.heartbeat,
        spawnable: entry.spawnable,
      },
    });
  }

  // 3. Pass 2 — resolve reports_to_agent_id now that all rows exist
  for (const [slot, entry] of slotEntries) {
    if (!entry.reports_to) continue;
    const agentId = agentIdForSlot(companyId, slot);
    const reportsToId = agentIdForSlot(companyId, entry.reports_to);
    await db.update(agents)
      .set({ reportsToAgentId: reportsToId })
      .where(sql`${agents.id} = ${agentId}`);
  }

  return {
    companies: 1,
    agents: slotEntries.length,
    warnings,
  };
}
