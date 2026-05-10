/** Side panel for adding a new agent to the swarm — reachable via the
 *  "+ Add new agent" button in the Phase 3 org chart header.
 *
 *  Two pickers + preview:
 *    1. Parent — which existing agent the new one reports to (any base
 *       roster slot OR any prior operator addition)
 *    2. Template — any of the 165 templates, grouped by division. The
 *       parent's division floats to the top so common picks are first.
 *    3. SKILL.md preview for the selected template.
 *
 *  Save → POST /api/instance/<id>/add-agent → writes manifest.template_additions
 *  → bridge merges into the agents row at activate time. */

import { useEffect, useMemo, useState } from "react";
import { opOmegaOnboardingApi, ApiError } from "../lib/api";
import { TEMPLATES, TEMPLATES_BY_ID, loadSkill, type AgentTemplate } from "../../data/templates";

export interface AgentAddPanelProps {
  companyId: string;
  /** Slots eligible to be parents — pass every base-roster slot + every
   *  prior operator addition's slot. Used to populate the parent dropdown. */
  parentChoices: Array<{ slot: string; division: string }>;
  /** Default parent slot to pre-select (e.g. "cmo" if the operator clicked
   *  Add from a chief's context). null = use first chief. */
  initialParent?: string | null;
  onClose: () => void;
  onAdded: (newSlot: string, parentSlot: string, templateId: string) => void;
}

interface Recommendation { templateId: string; parent_slot: string; rationale: string; score: number }

export function AgentAddPanel({ companyId, parentChoices, initialParent, onClose, onAdded }: AgentAddPanelProps) {
  // Default to the first chief if no initial parent
  const [parentSlot, setParentSlot] = useState<string>(initialParent ?? parentChoices[0]?.slot ?? "ceo.orchestrator");
  const [templateId, setTemplateId] = useState<string>("growth-hacker");
  const [skill, setSkill] = useState<string | null>(null);
  const [skillLoading, setSkillLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Natural-language recommendation state — operator types what they need,
  // T2 returns 3-5 ranked picks; clicking one selects it for the rest of
  // the flow. Designed to skip the 165-template scroll for non-technical
  // operators.
  const [nlPrompt, setNlPrompt] = useState("");
  const [recommending, setRecommending] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recommendError, setRecommendError] = useState<string | null>(null);
  // Tracks which recommendation card is currently mid-add (per-card busy
  // state, so other cards stay clickable while one is adding).
  const [addingFromCardKey, setAddingFromCardKey] = useState<string | null>(null);

  async function recommend(): Promise<void> {
    if (nlPrompt.trim().length < 3) return;
    setRecommending(true);
    setRecommendError(null);
    try {
      const r = await opOmegaOnboardingApi.recommendAgent({
        companyId, parent_slot: parentSlot, prompt: nlPrompt.trim(),
        // Pass every parent option so T2 can pick the right reporting line.
        // role_hint = the parent's division so T2 can map "marketing" → cmo, etc.
        available_parents: parentChoices.map((p) => ({ slot: p.slot, role_hint: p.division })),
      });
      setRecommendations(r.recommendations);
      // Auto-select the top pick — both the template AND the recommended parent
      if (r.recommendations.length > 0) {
        const top = r.recommendations[0];
        setTemplateId(top.templateId);
        setParentSlot(top.parent_slot);
      }
    } catch (e) {
      setRecommendError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setRecommending(false);
    }
  }

  // Group templates by division, parent's division first.
  const parentDivision = useMemo(() => {
    return parentChoices.find((p) => p.slot === parentSlot)?.division ?? "specialized";
  }, [parentChoices, parentSlot]);

  const templatesByDivision = useMemo<Array<{ division: string; templates: AgentTemplate[] }>>(() => {
    const groups: Record<string, AgentTemplate[]> = {};
    for (const t of TEMPLATES) {
      (groups[t.division] ??= []).push(t);
    }
    const order = [parentDivision, ...Object.keys(groups).filter((d) => d !== parentDivision).sort()];
    return order.map((division) => ({
      division,
      templates: (groups[division] ?? []).sort((a, b) => a.templateId.localeCompare(b.templateId)),
    })).filter((g) => g.templates.length > 0);
  }, [parentDivision]);

  const selectedTpl = TEMPLATES_BY_ID[templateId];

  useEffect(() => {
    let alive = true;
    setSkill(null);
    setSkillLoading(true);
    loadSkill(templateId).then((md) => {
      if (alive) {
        const stripped = md.replace(/^<!--[^>]*-->\s*/, "");
        setSkill(stripped.split("\n").slice(0, 80).join("\n"));
      }
    }).catch((e) => {
      if (alive) setSkill(`(SKILL.md unavailable: ${(e as Error).message})`);
    }).finally(() => { if (alive) setSkillLoading(false); });
    return () => { alive = false; };
  }, [templateId]);

  async function add(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const r = await opOmegaOnboardingApi.addAgent({
        companyId, parent_slot: parentSlot, template_id: templateId,
      });
      onAdded(r.added.slot, r.added.parent_slot, r.added.template_id);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /** One-click add from a specific recommendation card — uses that card's
   *  template + parent directly, bypassing the manual picker entirely. */
  async function addFromRecommendation(rec: Recommendation): Promise<void> {
    const key = `${rec.templateId}-${rec.parent_slot}`;
    setAddingFromCardKey(key);
    setError(null);
    setRecommendError(null);
    try {
      const r = await opOmegaOnboardingApi.addAgent({
        companyId, parent_slot: rec.parent_slot, template_id: rec.templateId,
      });
      onAdded(r.added.slot, r.added.parent_slot, r.added.template_id);
      onClose();
    } catch (e) {
      setRecommendError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setAddingFromCardKey(null);
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
          <h2 style={{ margin: 0, fontSize: 18 }}>+ Add new agent</h2>
          <button type="button" className="secondary" onClick={onClose} style={{ fontSize: 12 }}>✕ Close</button>
        </div>
        <div className="text-dim" style={{ fontSize: 12, marginBottom: "1rem" }}>
          Describe what you need in plain English, or pick a parent + template manually below.
        </div>

        {/* ── Natural-language recommendation (top of panel) ─────────────── */}
        <div style={{
          background: "var(--bg)",
          border: `1px solid ${recommendations.length > 0 ? "var(--accent)" : "var(--border)"}`,
          borderRadius: 6,
          padding: "0.85rem",
          marginBottom: "1.25rem",
        }}>
          <label style={{ display: "block", fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.4rem" }}>
            ✨ Describe what you need
          </label>
          <textarea
            value={nlPrompt}
            onChange={(e) => setNlPrompt(e.target.value)}
            placeholder="e.g. someone to manage our Meta + Google ad campaigns, or a person who can debug production incidents at 3am"
            rows={2}
            disabled={recommending}
            style={{ width: "100%", fontSize: 13, marginBottom: "0.5rem", resize: "vertical", minHeight: 56 }}
          />
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => void recommend()}
              disabled={recommending || nlPrompt.trim().length < 3}
              style={{ fontSize: 12 }}
            >
              {recommending ? "Recommending… (~10-30s)" : "Recommend agent"}
            </button>
            {recommendError && (
              <span style={{ fontSize: 11, color: "var(--warning)" }}>✗ {recommendError}</span>
            )}
          </div>

          {recommendations.length > 0 && (
            <div style={{ marginTop: "0.85rem" }}>
              <div className="text-dim" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.4rem" }}>
                Top {recommendations.length} pick{recommendations.length === 1 ? "" : "s"}
              </div>
              <div style={{ display: "grid", gap: "0.4rem" }}>
                {recommendations.map((r, i) => {
                  const cardKey = `${r.templateId}-${r.parent_slot}`;
                  const isSelected = r.templateId === templateId && r.parent_slot === parentSlot;
                  const isAddingThisCard = addingFromCardKey === cardKey;
                  const anyCardAdding = addingFromCardKey !== null;
                  return (
                    <div
                      key={cardKey}
                      style={{
                        padding: "0.6rem 0.75rem",
                        background: isSelected ? "var(--surface-2)" : "transparent",
                        border: `1px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                        borderRadius: 4,
                        color: "var(--text)",
                        fontSize: 12,
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        gap: "0.6rem",
                        alignItems: "center",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          // Click body applies BOTH the template AND the recommended parent
                          // for preview/manual flow (operator can still scroll down + tweak)
                          setTemplateId(r.templateId);
                          setParentSlot(r.parent_slot);
                        }}
                        disabled={anyCardAdding}
                        style={{
                          textAlign: "left", background: "transparent", border: "none",
                          padding: 0, color: "inherit", fontSize: "inherit", cursor: "pointer",
                        }}
                      >
                        <div>
                          <strong>#{i + 1}</strong> <strong>{r.templateId}</strong>
                          <span className="text-dim" style={{ marginLeft: 6, fontSize: 10 }}>→ reports to <strong>{r.parent_slot}</strong></span>
                          <span className="text-dim" style={{ marginLeft: 6, fontSize: 10 }}>· score {r.score}</span>
                          {isSelected && <span style={{ marginLeft: 6, color: "var(--accent)", fontSize: 10 }}>● selected</span>}
                        </div>
                        <div className="text-dim" style={{ fontSize: 11, marginTop: 4 }}>
                          {r.rationale}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => void addFromRecommendation(r)}
                        disabled={anyCardAdding}
                        title={`Add ${r.templateId} under ${r.parent_slot} immediately`}
                        style={{
                          fontSize: 11, padding: "0.35rem 0.6rem", whiteSpace: "nowrap",
                          background: isAddingThisCard ? "var(--surface-2)" : "var(--accent)",
                          color: isAddingThisCard ? "var(--text-dim)" : "var(--bg)",
                        }}
                      >
                        {isAddingThisCard ? "Adding…" : "+ Add"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Parent dropdown */}
        <label style={{ display: "block", fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.4rem" }}>
          Reports to
        </label>
        <select
          value={parentSlot}
          onChange={(e) => setParentSlot(e.target.value)}
          style={{ width: "100%", fontSize: 13, marginBottom: "1rem" }}
        >
          {parentChoices.map((p) => (
            <option key={p.slot} value={p.slot}>{p.slot} · {p.division}</option>
          ))}
        </select>

        {/* Template picker grouped by division */}
        <label style={{ display: "block", fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.4rem" }}>
          Template ({TEMPLATES.length} available)
        </label>
        <div style={{ marginBottom: "1rem", maxHeight: 320, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 4, padding: "0.5rem" }}>
          {templatesByDivision.map((group) => (
            <div key={group.division} style={{ marginBottom: "0.5rem" }}>
              <div className="text-dim" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>
                {group.division} ({group.templates.length}){group.division === parentDivision && " · same as parent"}
              </div>
              <div style={{ display: "grid", gap: "0.2rem" }}>
                {group.templates.map((t) => {
                  const isSelected = t.templateId === templateId;
                  return (
                    <button
                      key={t.templateId}
                      type="button"
                      onClick={() => setTemplateId(t.templateId)}
                      style={{
                        textAlign: "left",
                        padding: "0.35rem 0.5rem",
                        background: isSelected ? "var(--surface-2)" : "transparent",
                        border: `1px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                        borderRadius: 3,
                        cursor: "pointer",
                        color: "var(--text)",
                        fontSize: 12,
                        display: "flex",
                        alignItems: "baseline",
                        justifyContent: "space-between",
                        gap: "0.5rem",
                      }}
                    >
                      <span>
                        <strong>{t.templateId}</strong>
                        <span className="text-dim" style={{ marginLeft: 6, fontSize: 10 }}>tier {t.tier} · {t.role}</span>
                      </span>
                      <span className="text-dim" style={{ fontSize: 10 }}>{t.origin}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Slot preview */}
        <div className="text-dim" style={{ fontSize: 11, marginBottom: "0.75rem" }}>
          New slot will be: <code>{parentSlot}.{templateId}</code> (or auto-suffixed if it collides)
        </div>

        {/* SKILL preview */}
        <label style={{ display: "block", fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.4rem" }}>
          Preview · {templateId}
        </label>
        <div style={{
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: "0.75rem",
          fontSize: 11,
          fontFamily: "ui-monospace, monospace",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          maxHeight: 240,
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

        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
          <button type="button" className="secondary" onClick={onClose} disabled={busy} style={{ fontSize: 12 }}>
            Cancel
          </button>
          <button type="button" onClick={() => void add()} disabled={busy} style={{ fontSize: 12 }}>
            {busy ? "Adding…" : `+ Add ${templateId} under ${parentSlot}`}
          </button>
        </div>
      </div>
    </div>
  );
}
