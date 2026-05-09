/** Phase 3 — derived swarm manifest. Upstream SwarmManifest.agents is a
 *  Record<slotName, AgentManifestEntry> (NOT an array). Each entry has:
 *    status, adapter, heartbeat, budget_monthly_usd, skill_overlay,
 *    department, level, reports_to, spawnable, unpark_condition?,
 *    waiting_on_connector?, reason? */

import { useEffect, useState } from "react";
import { opOmegaOnboardingApi, ApiError } from "../lib/api";
import type { SwarmManifest } from "@op-omega/plugin-onboarding";
import { Card, H2, NavRow, P } from "../components/primitives";

interface Props { companyId: string; onComplete: () => void; }

const STATUS_COLOR: Record<string, string> = {
  active: "var(--accent)",
  standby: "var(--warning)",
  parked: "var(--text-dim)",
  disabled: "#555",
};

export function Phase3Swarm({ companyId, onComplete }: Props) {
  const [manifest, setManifest] = useState<SwarmManifest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string>("");

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

  useEffect(() => { void generate(true); }, [companyId]);

  const agentEntries = manifest ? Object.entries(manifest.agents) : [];
  const byStatus = agentEntries.reduce<Record<string, number>>((acc, [, a]) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: "2rem" }}>
      <H2>Phase 3 — Swarm</H2>
      <P>
        Predicate-driven activation: kernel (CEO + Chief of Staff) always active; C-suite
        roles activate by pillar signals + connector availability. Standby = ready but
        a required connector isn't wired yet. Parked = may unpark when business evolves.
      </P>

      {error && <Card><p style={{ color: "var(--warning)", margin: 0 }}>✗ {error}</p></Card>}

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <button type="button" className="secondary" onClick={() => void generate(true)} disabled={busy}>
          {busy ? "Deriving…" : "Re-derive (T0 fast)"}
        </button>
        <button type="button" onClick={() => void generate(false)} disabled={busy}>
          Refine with T2 →
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
    </div>
  );
}
