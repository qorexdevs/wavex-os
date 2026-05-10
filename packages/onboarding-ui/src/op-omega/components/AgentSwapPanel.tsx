/** Side panel for swapping the template assigned to a swarm slot.
 *
 *  Open via click on an OrgGraph node. Lists every alternative template in
 *  the same division (and adjacent divisions) so the operator can pick a
 *  better-fitting role for their company. Preview SKILL.md inline before
 *  committing. Save → POST /api/instance/<id>/swap-template → manifest's
 *  template_overlays records the substitution. */

import { useEffect, useState } from "react";
import { opOmegaOnboardingApi, ApiError } from "../lib/api";
import { TEMPLATES_BY_ID, TEMPLATES, loadSkill, type AgentTemplate } from "../../data/templates";

export interface AgentSwapPanelProps {
  companyId: string;
  slot: string;
  /** templateId currently bound to this slot (default OR operator overlay). */
  currentTemplateId: string;
  /** templateId from the catalog default (so we can show "Reset to default" appropriately). */
  defaultTemplateId: string;
  /** Parent slot the agent reports to. Required to enable "Add as new agent"
   *  (so we know which chief the new sibling reports under). Slots without a
   *  parent (ceo.orchestrator) get the add-button hidden. */
  parentSlot?: string | null;
  /** True if the current slot is itself an operator addition (not in the
   *  base op-omega roster). Removable via the panel. */
  isAddedAgent?: boolean;
  onClose: () => void;
  onSwapped: (newTemplateId: string | null) => void;
  /** Fired after a new agent was added under parentSlot. The parent surface
   *  re-fetches additions from the manifest so the org chart re-renders. */
  onAdded?: (newSlot: string, templateId: string) => void;
  /** Fired after this agent (an addition) was removed. */
  onRemoved?: (slot: string) => void;
}

/** Adjacent divisions for cross-discipline swaps. Each value is a list of
 *  divisions whose templates we ALSO surface as alternatives. Lets a `cdo.signal`
 *  (data) operator browse `engineering` + `specialized` templates without
 *  losing scoping entirely. */
const ADJACENT_DIVISIONS: Record<string, string[]> = {
  engineering: ["specialized", "integrations"],
  marketing: ["paid-media", "specialized"],
  sales: ["specialized"],
  product: ["design", "specialized"],
  design: ["product"],
  finance: ["specialized"],
  support: ["specialized"],
  testing: ["specialized"],
  "paid-media": ["marketing"],
  "project-management": ["specialized"],
  specialized: [],
  integrations: ["engineering"],
  strategy: ["product", "marketing"],
  "c-suite": [],
};

function alternativesFor(currentTemplateId: string, defaultTemplateId: string): AgentTemplate[] {
  const anchor = TEMPLATES_BY_ID[defaultTemplateId] ?? TEMPLATES_BY_ID[currentTemplateId];
  if (!anchor) return TEMPLATES;
  const allowedDivisions = new Set([anchor.division, ...(ADJACENT_DIVISIONS[anchor.division] ?? [])]);
  return TEMPLATES
    .filter((t) => allowedDivisions.has(t.division))
    .filter((t) => t.tier === anchor.tier || t.tier === anchor.tier + 1 || t.tier === anchor.tier - 1)
    .sort((a, b) => {
      // Current/default first, then by division then alphabetical
      if (a.templateId === currentTemplateId) return -1;
      if (b.templateId === currentTemplateId) return 1;
      if (a.templateId === defaultTemplateId) return -1;
      if (b.templateId === defaultTemplateId) return 1;
      if (a.division !== b.division) return a.division.localeCompare(b.division);
      return a.templateId.localeCompare(b.templateId);
    });
}

export function AgentSwapPanel({
  companyId, slot, currentTemplateId, defaultTemplateId,
  parentSlot, isAddedAgent, onClose, onSwapped, onAdded, onRemoved,
}: AgentSwapPanelProps) {
  const [selected, setSelected] = useState<string>(currentTemplateId);
  const [skill, setSkill] = useState<string | null>(null);
  const [skillLoading, setSkillLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alternatives = alternativesFor(currentTemplateId, defaultTemplateId);
  const selectedTpl = TEMPLATES_BY_ID[selected];
  const isDirty = selected !== currentTemplateId;
  const isOverlay = currentTemplateId !== defaultTemplateId;
  // Add is only meaningful when there's a parent + the operator picked something
  // different from the current template (otherwise it'd duplicate this exact agent).
  const canAdd = !!parentSlot && !!onAdded && selected !== currentTemplateId;

  // Load SKILL.md preview for the selected template
  useEffect(() => {
    let alive = true;
    setSkill(null);
    setSkillLoading(true);
    loadSkill(selected).then((md) => {
      if (alive) {
        // Trim leading credit comment if present + cap to first ~80 lines for preview
        const stripped = md.replace(/^<!--[^>]*-->\s*/, "");
        setSkill(stripped.split("\n").slice(0, 80).join("\n"));
      }
    }).catch((e) => {
      if (alive) setSkill(`(SKILL.md unavailable: ${(e as Error).message})`);
    }).finally(() => { if (alive) setSkillLoading(false); });
    return () => { alive = false; };
  }, [selected]);

  async function save(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const r = await opOmegaOnboardingApi.swapTemplate({
        companyId, slot,
        templateId: selected === defaultTemplateId ? null : selected,
      });
      onSwapped(r.templateId);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function resetToDefault(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await opOmegaOnboardingApi.swapTemplate({ companyId, slot, templateId: null });
      onSwapped(null);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function addAsNewAgent(): Promise<void> {
    if (!parentSlot || !onAdded) return;
    setBusy(true);
    setError(null);
    try {
      const r = await opOmegaOnboardingApi.addAgent({
        companyId, parent_slot: parentSlot, template_id: selected,
      });
      onAdded(r.added.slot, r.added.template_id);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeThisAddedAgent(): Promise<void> {
    if (!isAddedAgent || !onRemoved) return;
    setBusy(true);
    setError(null);
    try {
      await opOmegaOnboardingApi.removeAddedAgent({ companyId, slot });
      onRemoved(slot);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex", justifyContent: "flex-end",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--surface)",
          borderLeft: "1px solid var(--border)",
          width: "min(640px, 95vw)",
          height: "100vh",
          overflowY: "auto",
          padding: "1.5rem",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.5rem" }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Swap template</h2>
          <button type="button" className="secondary" onClick={onClose} style={{ fontSize: 12 }}>✕ Close</button>
        </div>
        <div className="text-dim" style={{ fontSize: 13, marginBottom: "0.25rem" }}>
          slot: <code>{slot}</code>
        </div>
        <div className="text-dim" style={{ fontSize: 12, marginBottom: "1rem" }}>
          Currently: <code>{currentTemplateId}</code>
          {isOverlay && <span style={{ marginLeft: 6, color: "var(--accent)" }}>(operator-overlay · default was <code>{defaultTemplateId}</code>)</span>}
        </div>

        <h3 style={{ fontSize: 12, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
          Alternatives ({alternatives.length})
        </h3>
        <div style={{ display: "grid", gap: "0.3rem", marginBottom: "1rem" }}>
          {alternatives.map((t) => {
            const isCurrent = t.templateId === currentTemplateId;
            const isDefault = t.templateId === defaultTemplateId;
            const isSelected = t.templateId === selected;
            return (
              <button
                key={t.templateId}
                type="button"
                onClick={() => setSelected(t.templateId)}
                style={{
                  textAlign: "left",
                  padding: "0.5rem 0.75rem",
                  background: isSelected ? "var(--surface-2)" : "transparent",
                  border: `1px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: 4,
                  cursor: "pointer",
                  color: "var(--text)",
                  fontSize: 13,
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: "0.5rem",
                }}
              >
                <span>
                  <strong>{t.templateId}</strong>
                  <span className="text-dim" style={{ marginLeft: 8, fontSize: 11 }}>{t.division} · tier {t.tier} · {t.role}</span>
                </span>
                <span style={{ fontSize: 10 }}>
                  {isCurrent && <span style={{ color: "var(--accent)" }}>● current</span>}
                  {!isCurrent && isDefault && <span style={{ color: "var(--text-dim)" }}>○ default</span>}
                </span>
              </button>
            );
          })}
        </div>

        <h3 style={{ fontSize: 12, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
          Preview · {selected}
        </h3>
        <div style={{
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: "0.75rem",
          fontSize: 11,
          fontFamily: "ui-monospace, monospace",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          maxHeight: 320,
          overflowY: "auto",
          color: "var(--text-dim)",
          marginBottom: "1rem",
        }}>
          {skillLoading ? "Loading SKILL.md…" : (skill ?? "(no preview)")}
        </div>

        {selectedTpl && (
          <div className="text-dim" style={{ fontSize: 11, marginBottom: "1rem" }}>
            Origin: {selectedTpl.origin} · {selectedTpl.defaultKpis.length > 0 ? `default KPIs: ${selectedTpl.defaultKpis.join(", ")}` : "no default KPIs"}
          </div>
        )}

        {error && <div style={{ color: "var(--warning)", fontSize: 12, marginBottom: "0.75rem" }}>✗ {error}</div>}

        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
          {isAddedAgent && onRemoved && (
            <button
              type="button"
              className="secondary"
              onClick={() => void removeThisAddedAgent()}
              disabled={busy}
              style={{ fontSize: 12, color: "var(--warning)", borderColor: "var(--warning)" }}
              title="Remove this operator-added agent"
            >
              ✕ Remove this agent
            </button>
          )}
          {isOverlay && !isAddedAgent && (
            <button type="button" className="secondary" onClick={() => void resetToDefault()} disabled={busy} style={{ fontSize: 12 }}>
              ↶ Reset to default ({defaultTemplateId})
            </button>
          )}
          <button type="button" className="secondary" onClick={onClose} disabled={busy} style={{ fontSize: 12 }}>
            Cancel
          </button>
          {canAdd && (
            <button
              type="button"
              onClick={() => void addAsNewAgent()}
              disabled={busy}
              style={{ fontSize: 12 }}
              title={`Add ${selected} as a NEW agent under ${parentSlot} (don't replace current)`}
            >
              {busy ? "Adding…" : `+ Add as new agent under ${parentSlot}`}
            </button>
          )}
          <button type="button" onClick={() => void save()} disabled={busy || !isDirty} style={{ fontSize: 12 }}>
            {busy ? "Saving…" : `Save swap → ${selected}`}
          </button>
        </div>
      </div>
    </div>
  );
}
