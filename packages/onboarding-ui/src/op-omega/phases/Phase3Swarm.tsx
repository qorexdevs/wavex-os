/** Phase 3 — derived swarm manifest. Upstream SwarmManifest.agents is a
 *  Record<slotName, AgentManifestEntry> (NOT an array). Each entry has:
 *    status, adapter, heartbeat, budget_monthly_usd, skill_overlay,
 *    department, level, reports_to, spawnable, unpark_condition?,
 *    waiting_on_connector?, reason? */

import { useEffect, useState } from "react";
import { opOmegaOnboardingApi, ApiError } from "../lib/api";
import type { SwarmManifest } from "@op-omega/plugin-onboarding";
import { Card, H2, NavRow, P } from "../components/primitives";
import { T2ProgressIndicator } from "../components/T2ProgressIndicator";
import { OrgGraph, type OrgAgent } from "../../components/OrgGraph";
import { AgentSwapPanel } from "../components/AgentSwapPanel";
import { AgentAddPanel } from "../components/AgentAddPanel";
import { templateIdForSlot } from "../../data/slot-to-template";
import { isT0FastMode } from "../lib/dev-flags";

interface Props { companyId: string; onComplete: () => void; }

const STATUS_COLOR: Record<string, string> = {
  active: "var(--accent)",
  standby: "var(--warning)",
  parked: "var(--text-dim)",
  disabled: "#555",
};

interface AddedAgent { slot: string; parent_slot: string; template_id: string; added_at: string }
interface ManifestWithOverlays {
  template_overlays?: Record<string, string>;
  template_additions?: AddedAgent[];
}

export function Phase3Swarm({ companyId, onComplete }: Props) {
  const [manifest, setManifest] = useState<SwarmManifest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string>("");
  // Swap panel state — opened on OrgGraph node click. Tracks the slot being
  // edited and the local overlays map (mirrors company.manifest.template_overlays
  // so swap saves/resets are reflected in the chart immediately).
  const [swapSlot, setSwapSlot] = useState<string | null>(null);
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [overlays, setOverlays] = useState<Record<string, string>>({});
  const [additions, setAdditions] = useState<AddedAgent[]>([]);

  async function generate(skipInference = false): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const r = await opOmegaOnboardingApi.generateSwarm(companyId, skipInference);
      setManifest(r.manifest);
      setSource(r.source);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Hydrate-first on mount: load existing swarm manifest from disk if the
  // operator already passed through this phase. T2 refinement only fires
  // for first-time visits or via the explicit "↻ Re-refine with T2" button.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const loaded = await opOmegaOnboardingApi.loadSwarm(companyId);
        if (!alive) return;
        if (loaded.exists && loaded.manifest) {
          setManifest(loaded.manifest);
          setSource("loaded");
          return;
        }
      } catch { /* fall through to generate */ }
      if (alive) await generate(isT0FastMode());
    })();
    return () => { alive = false; };
  }, [companyId]);

  // Hydrate template overlays from the on-disk manifest (saved by prior swap
  // sessions). The swarm-manifest endpoint doesn't return them, so fetch the
  // company manifest separately. Best-effort — if no manifest exists yet
  // (operator hasn't finalized), there can't be overlays anyway.
  useEffect(() => {
    let alive = true;
    opOmegaOnboardingApi.getInstanceManifest(companyId).then((r) => {
      if (!alive || !r.manifest) return;
      const m = r.manifest as unknown as ManifestWithOverlays;
      setOverlays(m.template_overlays ?? {});
      setAdditions(m.template_additions ?? []);
    }).catch(() => { /* manifest doesn't exist yet — fine */ });
    return () => { alive = false; };
  }, [companyId]);

  const agentEntries = manifest ? Object.entries(manifest.agents) : [];

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "2rem" }}>
      <H2>Phase 3 — Swarm</H2>
      <P>
        Predicate-driven activation: kernel (CEO + Chief of Staff) always active; C-suite
        roles activate by pillar signals + connector availability. T2 enrichment runs
        automatically — your Pillar 1 context shapes each agent's skill_overlay text.
      </P>

      {error && <Card><p style={{ color: "var(--warning)", margin: 0 }}>✗ {error}</p></Card>}

      <T2ProgressIndicator active={busy} phase="phase-3" />

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <button type="button" onClick={() => void generate(false)} disabled={busy}>
          {busy ? "Refining…" : "↻ Re-refine with T2"}
        </button>
        <button type="button" className="secondary" onClick={() => void generate(true)} disabled={busy}>
          Skip T2 (T0 fast)
        </button>
        {source && <span className="text-dim" style={{ fontSize: 12, alignSelf: "center" }}>source: {source}</span>}
      </div>

      {manifest && (
        <>
          <Card>
            <div style={{ display: "flex", gap: "1.5rem", fontSize: 13 }}>
              <span><strong>{manifest.topology.active_count}</strong> active</span>
              <span><strong>{manifest.topology.standby_count}</strong> standby</span>
              <span><strong>{manifest.topology.parked_count}</strong> parked</span>
              <span><strong>{manifest.topology.disabled_count}</strong> disabled</span>
              <span className="text-dim">· {manifest.topology.total_base_roster} total slots</span>
            </div>
          </Card>

          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.75rem", gap: "1rem", flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, fontSize: 12, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Org chart <span style={{ textTransform: "none", fontWeight: 400, color: "var(--text-dim)" }}>· click any agent to swap or remove</span>
              </h3>
              <button
                type="button"
                onClick={() => setAddPanelOpen(true)}
                style={{ fontSize: 12, padding: "0.35rem 0.75rem" }}
                title="Add a new agent under any existing parent"
              >
                + Add new agent
              </button>
            </div>
            <OrgGraph
              agents={[
                ...agentEntries.map(([slot, a]): OrgAgent => ({
                  id: slot,
                  slot,
                  templateId: overlays[slot] ?? templateIdForSlot(slot),
                  reportsToSlot: a.reports_to ?? undefined,
                  status: a.status,
                })),
                ...additions.map((add): OrgAgent => ({
                  id: add.slot,
                  slot: add.slot,
                  templateId: overlays[add.slot] ?? add.template_id,
                  reportsToSlot: add.parent_slot,
                  status: "active",
                })),
              ]}
              height={540}
              onAgentClick={(a) => setSwapSlot(a.slot)}
            />
            {(Object.keys(overlays).length > 0 || additions.length > 0) && (
              <div className="text-dim" style={{ fontSize: 11, marginTop: "0.5rem" }}>
                {Object.keys(overlays).length > 0 && `${Object.keys(overlays).length} swap${Object.keys(overlays).length === 1 ? "" : "s"} · `}
                {additions.length > 0 && `${additions.length} added agent${additions.length === 1 ? "" : "s"}`}
              </div>
            )}
          </Card>

          <Card>
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Slot", "Status", "Department", "Level", "Reports to", "Heartbeat", "Budget $/mo"].map((h) =>
                    <th key={h} style={{ textAlign: "left", padding: "0.5rem 0.5rem", fontWeight: 600, color: "var(--text-dim)" }}>{h}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {agentEntries.map(([slot, a]) => (
                  <tr key={slot} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.4rem 0.5rem", fontWeight: 600 }}>{slot}</td>
                    <td style={{ padding: "0.4rem 0.5rem" }}>
                      <span style={{ color: STATUS_COLOR[a.status], fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>{a.status}</span>
                      {a.waiting_on_connector && <span className="text-dim" style={{ fontSize: 10, marginLeft: 4 }}>(waiting on {a.waiting_on_connector})</span>}
                    </td>
                    <td style={{ padding: "0.4rem 0.5rem", color: "var(--text-dim)" }}>{a.department}</td>
                    <td style={{ padding: "0.4rem 0.5rem", color: "var(--text-dim)" }}>{a.level}</td>
                    <td style={{ padding: "0.4rem 0.5rem", color: "var(--text-dim)" }}>{a.reports_to ?? "—"}</td>
                    <td style={{ padding: "0.4rem 0.5rem", color: "var(--text-dim)" }}>{a.heartbeat}</td>
                    <td style={{ padding: "0.4rem 0.5rem", color: "var(--text-dim)" }}>${a.budget_monthly_usd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {manifest.spawn_eligibility.length > 0 && (
            <Card>
              <strong style={{ fontSize: 13 }}>S+ spawn eligibility</strong>
              <ul style={{ margin: "0.25rem 0 0 1rem", padding: 0, fontSize: 12 }}>
                {manifest.spawn_eligibility.map((s) => (
                  <li key={s.agent}><code>{s.agent}</code> · {s.rationale}</li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      <NavRow next={{ onClick: onComplete, label: "Continue → workflows" }} nextDisabled={busy || !manifest} />

      {addPanelOpen && (
        <AgentAddPanel
          companyId={companyId}
          parentChoices={[
            ...agentEntries.map(([slot, a]) => ({ slot, division: a.department })),
            ...additions.map((a) => {
              const parentDept = manifest?.agents?.[a.parent_slot]?.department ?? "ops";
              return { slot: a.slot, division: parentDept };
            }),
          ]}
          onClose={() => setAddPanelOpen(false)}
          onAdded={(newSlot, parentSlot, templateId) => {
            setAdditions((prev) => [...prev, {
              slot: newSlot, parent_slot: parentSlot, template_id: templateId, added_at: new Date().toISOString(),
            }]);
          }}
        />
      )}

      {swapSlot && (() => {
        // Resolve metadata about the clicked slot — could be a base-roster
        // entry or an operator addition. Both surfaces support swap; only
        // additions support remove.
        const baseEntry = manifest?.agents?.[swapSlot];
        const additionEntry = additions.find((a) => a.slot === swapSlot);
        const isAdded = !!additionEntry;
        const parentSlot = baseEntry?.reports_to ?? additionEntry?.parent_slot ?? null;
        const defaultTemplateId = isAdded
          ? (additionEntry!.template_id)
          : templateIdForSlot(swapSlot);
        const currentTemplateId = overlays[swapSlot] ?? defaultTemplateId;

        return (
          <AgentSwapPanel
            companyId={companyId}
            slot={swapSlot}
            currentTemplateId={currentTemplateId}
            defaultTemplateId={defaultTemplateId}
            parentSlot={parentSlot}
            isAddedAgent={isAdded}
            onClose={() => setSwapSlot(null)}
            onSwapped={(newTemplateId) => {
              setOverlays((prev) => {
                const next = { ...prev };
                if (newTemplateId === null) delete next[swapSlot];
                else next[swapSlot] = newTemplateId;
                return next;
              });
            }}
            onAdded={(newSlot, templateId) => {
              setAdditions((prev) => [...prev, {
                slot: newSlot, parent_slot: parentSlot ?? "", template_id: templateId, added_at: new Date().toISOString(),
              }]);
            }}
            onRemoved={(removedSlot) => {
              setAdditions((prev) => prev.filter((a) => a.slot !== removedSlot));
              setOverlays((prev) => {
                const next = { ...prev };
                delete next[removedSlot];
                return next;
              });
            }}
          />
        );
      })()}
    </div>
  );
}
