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

/** Friendly department headers rendered above each tier-2 chief column.
 *  Keys are chief slots (cmo, cro, ...); values are the human-readable
 *  department names shown to operators. Falls back to UPPER(slot) for any
 *  chief not in this map. */
const CHIEF_TO_DEPARTMENT: Record<string, string> = {
  ceo: "Executive",
  cpo: "Product",
  cmo: "Marketing",
  cro: "Revenue",
  cfo: "Finance",
  cdo: "Data",
  coo: "Operations",
};

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
  // Scope context — focused-mode operators see their selected departments
  // in the header strip. Hydrated from scope.json on mount.
  const [scope, setScope] = useState<{ mode: "full" | "focused"; departments: string[] } | null>(null);

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
      try {
        const s = await opOmegaOnboardingApi.getScope(companyId);
        if (s.scope) setScope({
          mode: s.scope.mode === "focused" ? "focused" : "full",
          departments: s.scope.departments ?? [],
        });
      } catch { /* scope not set yet; full org by default */ }
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
  // Counts powering the header stats line + footer status strip.
  const activeCount = agents.filter((a) => a.status === "active" || a.status === "standby").length;
  const parkedCount = agents.filter((a) => a.status === "parked" || a.status === "disabled").length;
  const swapCount = Object.keys(overlays).length;
  const addCount = additions.length;
  const scopeLabel = scope?.mode === "focused"
    ? `focused (${(scope.departments ?? []).join(" + ") || "no depts"})`
    : "full org";

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
        padding: "0.6rem 1.25rem",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "1rem",
      }}>
        {/* Left block: title + live stats line. The two-line stack keeps the
         *  header compact while surfacing scope + active/parked context that
         *  was previously buried in the footer. */}
        <div style={{ flex: "0 0 auto", minWidth: 0 }}>
          <div
            style={{ fontSize: 14, fontWeight: 700 }}
            title="Tap any role to swap. Hover for details. Use + to add a specialist."
          >
            Your team
          </div>
          <div className="text-dim" style={{ fontSize: 11, marginTop: 1 }}>
            <span style={{ color: "var(--accent)" }}>{activeCount} active</span>
            {" · "}
            <span>{parkedCount} parked</span>
            {" · "}
            <span>{scopeLabel}</span>
          </div>
        </div>

        {/* Center cluster: compact search + segmented filter. Both inline on
         *  one row so the chart canvas keeps its vertical real estate. */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.6rem", minWidth: 0 }}>
          <div style={{
            position: "relative",
            width: 320,
            maxWidth: "40vw",
          }}>
            <span
              aria-hidden
              style={{
                position: "absolute",
                left: 10, top: "50%", transform: "translateY(-50%)",
                color: "var(--text-dim)", fontSize: 12, pointerEvents: "none",
              }}
            >🔍</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search agents…"
              style={{
                width: "100%",
                padding: "0.4rem 0.7rem 0.4rem 1.85rem",
                borderRadius: 6,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                fontSize: 12,
                outline: "none",
              }}
            />
          </div>
          <div style={{
            display: "flex",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: 2,
          }}>
            {(["all", "active", "parked"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setStatusFilter(f)}
                style={{
                  padding: "0.25rem 0.7rem",
                  borderRadius: 4,
                  fontSize: 11,
                  cursor: "pointer",
                  background: statusFilter === f ? "var(--bg)" : "transparent",
                  color: statusFilter === f ? "var(--text)" : "var(--text-dim)",
                  border: "none",
                  fontWeight: statusFilter === f ? 600 : 400,
                  boxShadow: statusFilter === f ? "0 1px 0 rgba(0,0,0,0.2)" : "none",
                }}
              >
                {f === "all" ? "All" : f === "active" ? "Active" : "Parked"}
              </button>
            ))}
          </div>
          {hasFilter && (
            <span className="text-dim" style={{ fontSize: 11, whiteSpace: "nowrap" }}>
              {matchedCount} / {agents.length}
            </span>
          )}
        </div>

        {/* Right: secondary action, deliberately quieter than the footer's
         *  primary CTA so it doesn't compete visually. */}
        <button
          type="button"
          onClick={() => setAddPanelOpen(true)}
          title="Add a specialist agent"
          style={{
            padding: "0.35rem 0.7rem",
            borderRadius: 6,
            background: "transparent",
            color: "var(--text)",
            border: "1px solid var(--border)",
            fontWeight: 500,
            fontSize: 12,
            cursor: "pointer",
            flex: "0 0 auto",
          }}
        >
          + Add
        </button>
      </header>

      <div style={{ flex: 1, overflow: "hidden" }}>
        <OrgGraph
          agents={agents}
          height={window.innerHeight - 140}
          onAgentClick={(a) => setSwapSlot(a.slot)}
          highlightSlots={highlightSlots}
          hoverDetail={hoverDetailFor}
          showDepartmentLabels
          departmentLabels={CHIEF_TO_DEPARTMENT}
        />
      </div>

      <footer style={{
        padding: "0.6rem 1.25rem",
        borderTop: "1px solid var(--border)",
        background: "color-mix(in srgb, var(--surface) 92%, transparent)",
        backdropFilter: "blur(6px)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "1rem",
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
            flex: "0 0 auto",
          }}
        >
          ← Back to chat
        </button>
        {/* Status strip — granular counts so the operator can see their
         *  edits accumulate. Each segment is muted by default; active +
         *  edited segments take on accent color so they pop. */}
        <div style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          gap: "1.1rem",
          fontSize: 11,
          color: "var(--text-dim)",
          flexWrap: "wrap",
        }}>
          <span>
            <span style={{ color: "var(--accent)" }}>●</span> {activeCount} active
          </span>
          <span>
            <span>↷</span> {parkedCount} parked
          </span>
          <span style={{ color: swapCount > 0 ? "var(--accent)" : undefined }}>
            • {swapCount} swap{swapCount === 1 ? "" : "s"}
          </span>
          <span style={{ color: addCount > 0 ? "var(--accent)" : undefined }}>
            + {addCount} added
          </span>
          <span className="text-dim" style={{ opacity: 0.7 }}>
            ({totalCount} total)
          </span>
        </div>
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
            flex: "0 0 auto",
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
