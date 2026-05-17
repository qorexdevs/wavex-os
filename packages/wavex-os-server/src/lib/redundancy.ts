/** Agent redundancy detection — exact templateId collision after the
 *  full resolution chain (overlay > addition > selection > default).
 *
 *  This is the cheap, deterministic version of "do these slots overlap":
 *  it groups by templateId and surfaces groups with size > 1. Same-parent
 *  collisions are louder than cross-parent ones (3 financial-analysts
 *  under CFO is a real redundancy; one growth-hacker each under CPO and
 *  CMO is plausibly intentional). The UI ranks by `weight` so operators
 *  see the worst offenders first.
 *
 *  Pairs with manifest.template_mutes (string[]): operator can mark slots
 *  as muted to remove them from the swarm without losing the manifest's
 *  intent record. The bridge skips muted slots when writing agents to DB.
 *  Reset clears mutes along with everything else. */

import type { CompanyManifest } from "@wavex-os/plugin-onboarding";
import { templateIdForSlot } from "../bridge/catalog.js";
import { selectTemplatesForManifest } from "../selection/scorer.js";

interface ManifestExt extends CompanyManifest {
  template_overlays?: Record<string, string>;
  template_additions?: Array<{ slot: string; parent_slot: string; template_id: string; added_at: string }>;
  template_mutes?: string[];
}

export interface ResolvedSlot {
  slot: string;
  parent_slot: string;
  template_id: string;
  origin: "overlay" | "addition" | "selection" | "default";
  muted: boolean;
}

export interface RedundancyGroup {
  /** The templateId that's been picked for >1 slot. */
  template_id: string;
  /** Slots that resolved to this template (already filtered to non-muted). */
  slots: ResolvedSlot[];
  /** Map of parent_slot → count, so the UI can show "3 under CFO" cleanly. */
  by_parent: Record<string, number>;
  /** Higher = louder. Same-parent dups weigh ×3 vs cross-parent. */
  weight: number;
}

/** Walks the manifest using the same resolution rules as finalize-bridge,
 *  returning every active (non-muted) slot with its resolved template. */
export function resolveAllSlots(manifest: CompanyManifest): ResolvedSlot[] {
  const m = manifest as ManifestExt;
  const overlays = m.template_overlays ?? {};
  const additions = m.template_additions ?? [];
  const mutes = new Set(m.template_mutes ?? []);
  const additionBySlot = new Map(additions.map((a) => [a.slot, a]));
  const selections = selectTemplatesForManifest(manifest);

  const baseEntries = Object.entries(manifest.swarm_manifest.agents);
  const addedSlots: Array<[string, { reports_to: string }]> = additions.map((a) => [
    a.slot, { reports_to: a.parent_slot },
  ]);

  const out: ResolvedSlot[] = [];
  for (const [slot, entry] of [...baseEntries, ...addedSlots]) {
    const overlay = overlays[slot];
    const addition = additionBySlot.get(slot);
    const selection = selections.get(slot);
    const template_id = overlay ?? addition?.template_id ?? selection?.chosenTemplateId ?? templateIdForSlot(slot);
    const origin: ResolvedSlot["origin"] = overlay ? "overlay"
      : addition ? "addition"
      : selection?.diverged ? "selection"
      : "default";
    out.push({
      slot,
      parent_slot: entry.reports_to ?? "",
      template_id,
      origin,
      muted: mutes.has(slot),
    });
  }
  return out;
}

/** Detects exact-templateId duplicates across the resolved slot list. */
export function detectRedundancy(manifest: CompanyManifest): RedundancyGroup[] {
  const slots = resolveAllSlots(manifest).filter((s) => !s.muted);
  const byTemplate = new Map<string, ResolvedSlot[]>();
  for (const s of slots) {
    if (!byTemplate.has(s.template_id)) byTemplate.set(s.template_id, []);
    byTemplate.get(s.template_id)!.push(s);
  }
  const groups: RedundancyGroup[] = [];
  for (const [template_id, list] of byTemplate.entries()) {
    if (list.length < 2) continue;
    const by_parent: Record<string, number> = {};
    for (const s of list) by_parent[s.parent_slot] = (by_parent[s.parent_slot] ?? 0) + 1;
    // Weight: each duplicate within the same parent counts ×3, cross-parent
    // duplicates count ×1. So 3-under-one-parent (weight 6) ranks above
    // 2-cross-parent (weight 1).
    let weight = 0;
    for (const [, count] of Object.entries(by_parent)) {
      if (count > 1) weight += (count - 1) * 3;
    }
    if (weight === 0) weight = list.length - 1; // cross-parent only
    groups.push({ template_id, slots: list, by_parent, weight });
  }
  groups.sort((a, b) => b.weight - a.weight);
  return groups;
}
