/** Swarm Studio — full-screen reveal that takes over the chat once the
 *  swarm manifest arrives. Reuses the existing OrgGraph (the same chart
 *  Mission Control renders) so the operator sees a consistent visual
 *  identity across onboarding and post-activation. AgentSwapPanel and
 *  AgentAddPanel are mounted as overlays for in-place edits.
 *
 *  Confirming the studio fires the Phase 4 workflow prefetch in the
 *  background — by the time the Imprint Theater finishes playing, the
 *  T2-enriched workflow manifest is on disk and finalize uses it. */

import { useEffect, useMemo, useState } from "react";
import type { SwarmManifest } from "@op-omega/plugin-onboarding";
import { opOmegaOnboardingApi, ApiError } from "../lib/api";
import { OrgGraph, type OrgAgent } from "../../components/OrgGraph";
import { AgentSwapPanel } from "../components/AgentSwapPanel";
import { AgentAddPanel } from "../components/AgentAddPanel";
import { templateIdForSlot } from "../../data/slot-to-template";

interface AddedAgent { slot: string; parent_slot: string; template_id: string; added_at: string }
interface ManifestWithOverlays {
  template_overlays?: Record<string, string>;
  template_additions?: AddedAgent[];
}

interface Props {
  companyId: string;
  manifest: SwarmManifest;
  onConfirmed: () => void;
  onBackToChat: () => void;
}

export function SwarmStudio({ companyId, manifest, onConfirmed, onBackToChat }: Props) {
  const [overlays, setOverlays] = useState<Record<string, string>>({});
  const [additions, setAdditions] = useState<AddedAgent[]>([]);
  const [swapSlot, setSwapSlot] = useState<string | null>(null);
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  // Search + filter UI state — let operators slice a 35-agent chart by
  // free-text match (slot/template) or by status preset. Non-matching
  // agents stay in the layout but dim out so context isn't lost.
  const [searchTerm, setSearchTerm] = useState("");
  type StatusFilter = "all" | "active" | "parked";
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Pull existing overlays + additions from the live company manifest so
  // re-entry preserves prior swaps/adds.
  useEffect(() => {
    (async () => {
      try {
        const r = await opOmegaOnboardingApi.getInstanceManifest(companyId);
        const m = r.manifest as ManifestWithOverlays | undefined;
        if (m?.template_overlays) setOverlays(m.template_overlays);
        if (m?.template_additions) setAdditions(m.template_additions);
      } catch { /* first-time entry; nothing to hydrate */ }
    })();
  }, [companyId]);

  const agentEntries = useMemo(() => Object.entries(manifest.agents), [manifest]);
  const agents = useMemo<OrgAgent[]>(() => [
    ...agentEntries.map(([slot, a]) => ({
      id: slot,
      slot,
      templateId: overlays[slot] ?? templateIdForSlot(slot),
      reportsToSlot: a.reports_to ?? undefined,
      status: a.status as OrgAgent["status"],
    })),
    ...additions.map((add): OrgAgent => ({
      id: add.slot,
      slot: add.slot,
      templateId: overlays[add.slot] ?? add.template_id,
      reportsToSlot: add.parent_slot,
      status: "active",
    })),
  ], [agentEntries, overlays, additions]);

  const totalCount = agents.length;
  const swapAgent = swapSlot ? agents.find((a) => a.slot === swapSlot) : null;

  // Build highlight set + hover-detail callback for OrgGraph. The set is
  // `undefined` when no filter is active (preserves OrgGraph's default
  // styling); otherwise non-matching agents render at reduced opacity.
  const normalizedTerm = searchTerm.trim().toLowerCase();
  const hasFilter = normalizedTerm.length > 0 || statusFilter !== "all";
  const matchedCount = hasFilter
    ? agents.filter((a) => {
        const matchesText = normalizedTerm === ""
          || a.slot.toLowerCase().includes(normalizedTerm)
          || a.templateId.toLowerCase().includes(normalizedTerm);
        const matchesStatus =
          statusFilter === "all"
          || (statusFilter === "active" && (a.status === "active" || a.status === "standby"))
          || (statusFilter === "parked" && (a.status === "parked" || a.status === "disabled"));
        return matchesText && matchesStatus;
      }).length
    : agents.length;
  const highlightSlots = hasFilter
    ? new Set(agents.filter((a) => {
        const matchesText = normalizedTerm === ""
          || a.slot.toLowerCase().includes(normalizedTerm)
          || a.templateId.toLowerCase().includes(normalizedTerm);
        const matchesStatus =
          statusFilter === "all"
          || (statusFilter === "active" && (a.status === "active" || a.status === "standby"))
          || (statusFilter === "parked" && (a.status === "parked" || a.status === "disabled"));
        return matchesText && matchesStatus;
      }).map((a) => a.id))
    : undefined;

  function hoverDetailFor(a: OrgAgent): string {
    const dept = manifest.agents[a.slot]?.department ?? "—";
    const reportsTo = a.reportsToSlot ?? "—";
    const status = a.status ?? "unknown";
    return `${a.slot}\n  template: ${a.templateId}\n  department: ${dept}\n  status: ${status}\n  reports to: ${reportsTo}`;
  }

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 60,
      background: "var(--bg)",
      display: "flex",
      flexDirection: "column",
    }}>
      <header style={{
        padding: "0.75rem 1.25rem",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "1rem",
      }}>
        <div style={{ flex: "0 0 auto" }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Your team</div>
          <div className="text-dim" style={{ fontSize: 11 }}>
            Tap any role to swap. Hover for details. Use + to add a specialist.
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.6rem", flexWrap: "wrap" }}>
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by slot or template…"
            style={{
              minWidth: 240,
              padding: "0.4rem 0.7rem",
              borderRadius: 6,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--text)",
              fontSize: 12,
              outline: "none",
            }}
          />
          <div style={{ display: "flex", gap: "0.3rem" }}>
            {(["all", "active", "parked"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setStatusFilter(f)}
                style={{
                  padding: "0.3rem 0.65rem",
                  borderRadius: 999,
                  fontSize: 11,
                  cursor: "pointer",
                  background: statusFilter === f ? "var(--accent)" : "transparent",
                  color: statusFilter === f ? "var(--bg)" : "var(--text-dim)",
                  border: `1px solid ${statusFilter === f ? "var(--accent)" : "var(--border)"}`,
                  fontWeight: statusFilter === f ? 600 : 400,
                }}
              >
                {f === "all" ? "All" : f === "active" ? "Active only" : "Parked only"}
              </button>
            ))}
          </div>
          {hasFilter && (
            <span className="text-dim" style={{ fontSize: 11 }}>
              {matchedCount} / {agents.length} match
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setAddPanelOpen(true)}
          style={{
            padding: "0.4rem 0.85rem",
            borderRadius: 6,
            background: "transparent",
            color: "var(--accent)",
            border: "1px solid var(--accent)",
            fontWeight: 600,
            fontSize: 12,
            cursor: "pointer",
            flex: "0 0 auto",
          }}
        >
          + Add agent
        </button>
      </header>

      <div style={{ flex: 1, overflow: "hidden" }}>
        <OrgGraph
          agents={agents}
          height={window.innerHeight - 140}
          onAgentClick={(a) => setSwapSlot(a.slot)}
          highlightSlots={highlightSlots}
          hoverDetail={hoverDetailFor}
        />
      </div>

      <footer style={{
        padding: "0.75rem 1.25rem",
        borderTop: "1px solid var(--border)",
        background: "color-mix(in srgb, var(--surface) 92%, transparent)",
        backdropFilter: "blur(6px)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <button
          type="button"
          onClick={onBackToChat}
          style={{
            padding: "0.4rem 0.75rem",
            borderRadius: 6,
            background: "transparent",
            color: "var(--text-dim)",
            border: "1px solid var(--border)",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          ← Back to chat
        </button>
        <span className="text-dim" style={{ fontSize: 12 }}>
          {totalCount} agents
          {Object.keys(overlays).length > 0 && ` · ${Object.keys(overlays).length} swap${Object.keys(overlays).length === 1 ? "" : "s"}`}
          {additions.length > 0 && ` · ${additions.length} added`}
        </span>
        <button
          type="button"
          onClick={onConfirmed}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: 6,
            background: "var(--accent)",
            color: "var(--bg)",
            border: "none",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          These look right — wire them up →
        </button>
      </footer>

      {swapAgent && (
        <AgentSwapPanel
          companyId={companyId}
          slot={swapAgent.slot}
          currentTemplateId={swapAgent.templateId}
          defaultTemplateId={templateIdForSlot(swapAgent.slot)}
          parentSlot={swapAgent.reportsToSlot ?? null}
          isAddedAgent={additions.some((a) => a.slot === swapAgent.slot)}
          onClose={() => setSwapSlot(null)}
          onSwapped={(nextTemplateId) => {
            setOverlays((prev) => {
              const next = { ...prev };
              if (nextTemplateId === null) delete next[swapAgent.slot];
              else next[swapAgent.slot] = nextTemplateId;
              return next;
            });
            setSwapSlot(null);
          }}
          onRemoved={() => {
            setAdditions((prev) => prev.filter((a) => a.slot !== swapAgent.slot));
            setSwapSlot(null);
          }}
        />
      )}

      {addPanelOpen && (
        <AgentAddPanel
          companyId={companyId}
          parentChoices={[
            ...agentEntries.map(([slot, a]) => ({ slot, division: a.department })),
            ...additions.map((a) => {
              const parentDept = manifest.agents[a.parent_slot]?.department ?? "ops";
              return { slot: a.slot, division: parentDept };
            }),
          ]}
          onClose={() => setAddPanelOpen(false)}
          onAdded={(newSlot, parentSlot, templateId) => {
            setAdditions((prev) => [...prev, {
              slot: newSlot,
              parent_slot: parentSlot,
              template_id: templateId,
              added_at: new Date().toISOString(),
            }]);
            setAddPanelOpen(false);
          }}
        />
      )}
    </div>
  );
}
