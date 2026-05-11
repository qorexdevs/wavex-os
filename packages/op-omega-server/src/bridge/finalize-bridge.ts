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
  template_additions?: Array<{
    slot: string;
    parent_slot: string;
    template_id: string;
    added_at: string;
  }>;
  template_selections?: Record<string, {
    chosenTemplateId: string;
    defaultTemplateId: string;
    diverged: boolean;
    score: number;
    rationale: string;
  }>;
  /** Slots the operator has muted via the redundancy review. The bridge
   *  skips them when writing agents to DB; the manifest still records them
   *  so a future un-mute can restore the slot without re-running phases. */
  template_mutes?: string[];
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
  // Operator additions (manifest.template_additions) merge in here as
  // pseudo-base-roster entries with synthesized AgentManifestEntry shape.
  // They inherit the parent's status semantics (default active).
  const additions = (manifest as ManifestWithOverlays).template_additions ?? [];
  const baseEntries = Object.entries(manifest.swarm_manifest.agents);
  const addedEntries: Array<[string, typeof baseEntries[0][1]]> = additions.map((a) => {
    const parentEntry = manifest.swarm_manifest.agents[a.parent_slot];
    return [a.slot, {
      status: "active" as const,
      adapter: parentEntry?.adapter ?? "claude-code",
      heartbeat: parentEntry?.heartbeat ?? "2h",
      budget_monthly_usd: parentEntry?.budget_monthly_usd ?? 60,
      skill_overlay: null,
      department: parentEntry?.department ?? "ops",
      level: "L·IV" as const,
      reports_to: a.parent_slot,
      spawnable: true,
    }];
  });
  const slotEntries = [...baseEntries, ...addedEntries];
  if (additions.length > 0) {
    warnings.push(`${additions.length} operator-added agent${additions.length === 1 ? "" : "s"} merged into roster`);
  }
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

  // Index additions by slot so we can resolve their explicit template_id
  // without going through SLOT_TO_TEMPLATE (which doesn't know about them).
  const additionBySlot = new Map(additions.map((a) => [a.slot, a]));

  // Operator mutes from the redundancy review — skip these slots entirely.
  // Persisting them on the manifest (rather than deleting the slot) keeps
  // the un-mute path cheap and doesn't lose the matrix's original choice.
  const mutes = new Set((manifest as ManifestWithOverlays).template_mutes ?? []);
  if (mutes.size > 0) {
    warnings.push(`${mutes.size} slot${mutes.size === 1 ? "" : "s"} muted by operator: ${[...mutes].join(", ")}`);
  }

  for (const [slot, entry] of slotEntries) {
    if (mutes.has(slot)) continue;
    const tier = tierForSlot(slot);
    const overlayTemplate = overlays[slot];
    const addition = additionBySlot.get(slot);
    const selection = selections.get(slot);
    // Resolution order for added agents: overlay > addition.template_id > selection > default.
    // Resolution order for base roster: overlay > selection > default.
    const templateId = overlayTemplate
      ?? addition?.template_id
      ?? selection?.chosenTemplateId
      ?? templateIdForSlot(slot);
    if (!addition && templateId === slot && !slot.match(/^(ceo\.orchestrator|cpo|cmo|cro|cfo|cdo|coo)$/)) {
      warnings.push(`no template mapping for slot "${slot}" — using slot as templateId fallback`);
    }
    if (overlayTemplate) {
      warnings.push(`slot "${slot}" using operator-chosen overlay template "${overlayTemplate}" (default was "${templateIdForSlot(slot)}")`);
    } else if (addition) {
      warnings.push(`slot "${slot}" is an operator-added agent (template "${addition.template_id}", added ${addition.added_at})`);
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

  // 3. Pass 2 — resolve reports_to_agent_id now that all rows exist.
  //    Skip muted slots (their row was never inserted) and re-parent any
  //    children whose direct parent was muted to that parent's grandparent.
  //    Walks both base roster + operator additions so additions can be
  //    chained through too (rare but possible).
  const slotEntryMap = new Map(slotEntries);
  function effectiveParent(slot: string): string | null {
    let next: string | null = slot;
    while (next && mutes.has(next)) {
      const entry = slotEntryMap.get(next);
      next = entry?.reports_to ?? null;
    }
    return next;
  }
  for (const [slot, entry] of slotEntries) {
    if (mutes.has(slot)) continue;
    if (!entry.reports_to) continue;
    const parent = effectiveParent(entry.reports_to);
    if (!parent) continue;
    const agentId = agentIdForSlot(companyId, slot);
    const reportsToId = agentIdForSlot(companyId, parent);
    await db.update(agents)
      .set({ reportsToAgentId: reportsToId })
      .where(sql`${agents.id} = ${agentId}`);
  }

  const insertedCount = slotEntries.length - mutes.size;
  return {
    companies: 1,
    agents: insertedCount,
    warnings,
  };
}
