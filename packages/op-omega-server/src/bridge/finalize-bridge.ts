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
import { selectTemplatesForManifest } from "../selection/scorer.js";

interface ManifestWithOverlays extends CompanyManifest {
  template_overlays?: Record<string, string>;
  template_selections?: Record<string, {
    chosenTemplateId: string;
    defaultTemplateId: string;
    diverged: boolean;
    score: number;
    rationale: string;
  }>;
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

  // Resolution order per slot:
  //   1. operator overlay (manual swap)  → highest priority
  //   2. matrix selection (deterministic scorer)
  //   3. catalog default (SLOT_TO_TEMPLATE)
  //
  // The scorer reads pillar 1/3/4 + connector_manifest.required and picks the
  // strongest-fit template from a curated candidate list per slot. Slots
  // without per-company variation just return the catalog default.
  const overlays = (manifest as ManifestWithOverlays).template_overlays ?? {};
  const selections = selectTemplatesForManifest(manifest);

  // Persist selections back onto the manifest so the dashboard / swap UI can
  // surface the rationale and so refinement loops carry it through.
  (manifest as ManifestWithOverlays).template_selections = Object.fromEntries(
    [...selections.entries()].map(([slot, sel]) => [slot, {
      chosenTemplateId: sel.chosenTemplateId,
      defaultTemplateId: sel.defaultTemplateId,
      diverged: sel.diverged,
      score: sel.score,
      rationale: sel.rationale,
    }]),
  );

  for (const [slot, entry] of slotEntries) {
    const tier = tierForSlot(slot);
    const overlayTemplate = overlays[slot];
    const selection = selections.get(slot);
    const templateId = overlayTemplate ?? selection?.chosenTemplateId ?? templateIdForSlot(slot);
    if (templateId === slot && !slot.match(/^(ceo\.orchestrator|cpo|cmo|cro|cfo|cdo|coo)$/)) {
      warnings.push(`no template mapping for slot "${slot}" — using slot as templateId fallback`);
    }
    if (overlayTemplate) {
      warnings.push(`slot "${slot}" using operator-chosen overlay template "${overlayTemplate}" (default was "${templateIdForSlot(slot)}")`);
    } else if (selection?.diverged) {
      warnings.push(`slot "${slot}" matrix-selected "${selection.chosenTemplateId}" (default was "${selection.defaultTemplateId}") — ${selection.rationale}`);
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
