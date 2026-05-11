/** Kernel slots — agents that should ALWAYS exist in the swarm regardless
 *  of what the matrix selector decides. Per docs/MINIMAL_INCEPTION.md,
 *  the kernel = CEO + Chief of Staff (one acts, one observes). The CEO
 *  comes from the vendored op-omega base roster; the CoS does not, so we
 *  inject it here at swarm-manifest generation time.
 *
 *  Adding more kernel slots in the future (e.g. Recovery Engineer per
 *  the docs) is a one-entry addition to KERNEL_SLOTS — no other code
 *  changes needed. */

import type { CompanyManifest } from "@op-omega/plugin-onboarding";

type AgentEntry = CompanyManifest["swarm_manifest"]["agents"][string];

interface SwarmManifestShape {
  agents: Record<string, AgentEntry>;
}

export interface KernelSlot {
  slot: string;
  parent_slot: string;
  template_id: string;
  /** AgentEntry overrides; the rest defaults to sensible values. */
  entry: Partial<AgentEntry>;
}

/** The canonical kernel. Order does not matter — injection is keyed by slot. */
export const KERNEL_SLOTS: KernelSlot[] = [
  {
    slot: "ceo.chief-of-staff",
    parent_slot: "ceo.orchestrator",
    template_id: "chief-of-staff",
    entry: {
      // CoS reads on a 4h cadence per its own SKILL_FLEET_ALIGNMENT routine.
      heartbeat: "4h",
      // "ceo" is the closest AgentDepartment for a slot that sits at the
      // CEO level (board|ceo|product|marketing|revenue|finance|data|ops).
      department: "ceo" as const,
      level: "L·II",
      budget_monthly_usd: 90,
      spawnable: true,
    },
  },
];

function defaultEntry(parent: AgentEntry | undefined, ks: KernelSlot): AgentEntry {
  return {
    status: "active",
    adapter: parent?.adapter ?? "claude-code",
    heartbeat: ks.entry.heartbeat ?? parent?.heartbeat ?? "4h",
    budget_monthly_usd: ks.entry.budget_monthly_usd ?? 60,
    skill_overlay: null,
    department: ks.entry.department ?? "executive",
    level: ks.entry.level ?? "L·II",
    reports_to: ks.parent_slot,
    spawnable: ks.entry.spawnable ?? true,
  } as AgentEntry;
}

/** Mutates the given swarm-manifest in place, adding any kernel slots that
 *  aren't already present. Idempotent — safe to call on re-generated
 *  manifests, and won't clobber operator overrides if they've already
 *  customized the slot. Returns whether any change was made. */
export function injectKernelSlots(swarm: SwarmManifestShape): boolean {
  let changed = false;
  for (const ks of KERNEL_SLOTS) {
    if (swarm.agents[ks.slot]) continue;
    const parent = swarm.agents[ks.parent_slot];
    swarm.agents[ks.slot] = defaultEntry(parent, ks);
    changed = true;
  }
  return changed;
}

/** Lookup helper for code that needs to know "is this a kernel slot?" */
export function isKernelSlot(slot: string): boolean {
  return KERNEL_SLOTS.some((ks) => ks.slot === slot);
}
