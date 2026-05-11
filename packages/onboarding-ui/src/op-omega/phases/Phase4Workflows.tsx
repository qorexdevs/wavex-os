/** Phase 4 — derived workflow manifest. Upstream WorkflowManifest shape:
 *    agent_workflows: Record<slot, AgentWorkflow>
 *    bundle_workflows: Record<bundleId, BundleWorkflow>
 *    scheduled_routines_enabled: Record<name, cron>
 *    dry_run_gates: string[] of "{agent}.{task}" identifiers
 *    t2_patches?: T2PatchRecord[] (audit trail)
 *  AgentWorkflow has: heartbeat, on_fire[], escalation[] */

import { useEffect, useState } from "react";
import { opOmegaOnboardingApi, ApiError } from "../lib/api";
import type { WorkflowManifest } from "@op-omega/plugin-onboarding";
import { Card, H2, NavRow, P } from "../components/primitives";
import { T2ProgressIndicator } from "../components/T2ProgressIndicator";
import { isT0FastMode } from "../lib/dev-flags";

interface Props { companyId: string; onComplete: () => void; }

export function Phase4Workflows({ companyId, onComplete }: Props) {
  const [manifest, setManifest] = useState<WorkflowManifest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string>("");

  async function generate(skipInference = false): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const r = await opOmegaOnboardingApi.generateWorkflow(companyId, { skipInference, bypassBudgetCheck: true });
      setManifest(r.manifest);
      setSource(r.source);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Hydrate-first on mount: load existing workflow manifest from disk if the
  // operator already passed through this phase. T2 refinement only fires
  // for first-time visits or via the explicit "↻ Re-refine with T2" button.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const loaded = await opOmegaOnboardingApi.loadWorkflow(companyId);
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

  const agentWorkflows = manifest ? Object.entries(manifest.agent_workflows) : [];
  const bundleWorkflows = manifest ? Object.entries(manifest.bundle_workflows) : [];
  const routines = manifest ? Object.entries(manifest.scheduled_routines_enabled) : [];
  const t2patches = manifest?.t2_patches ?? [];

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "2rem" }}>
      <H2>Phase 4 — Workflows</H2>
      <P>
        Per-agent on_fire task sequences + cross-agent bundle workflows + scheduled
        routines. The 14-day dry_run gate suppresses writes for new high-risk tasks.
        T2 patches with pillar_signal attribution land automatically — see the
        T2 patches block below for what changed and why.
      </P>

      {error && <Card><p style={{ color: "var(--warning)", margin: 0 }}>✗ {error}</p></Card>}

      <T2ProgressIndicator active={busy} phase="phase-4" />

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
            <h3 style={{ marginTop: 0, fontSize: 14, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Per-agent workflows ({agentWorkflows.length})
            </h3>
            {agentWorkflows.map(([slot, wf]) => (
              <div key={slot} style={{ borderBottom: "1px solid var(--border)", padding: "0.5rem 0", fontSize: 13 }}>
                <div><strong>{slot}</strong> <span className="text-dim" style={{ fontSize: 11 }}>· heartbeat {wf.heartbeat} · {wf.on_fire.length} tasks</span></div>
                <div className="text-dim" style={{ fontSize: 11, marginTop: 2 }}>
                  {wf.on_fire.map((t) => t.task + (t.dry_run_gate ? "🔒" : "")).join(" → ")}
                </div>
                {wf.escalation.length > 0 && (
                  <div className="text-dim" style={{ fontSize: 10, marginTop: 2 }}>
                    escalation: {wf.escalation.map((e) => `${e.on}→${e.to}`).join(", ")}
                  </div>
                )}
              </div>
            ))}
          </Card>

          {bundleWorkflows.length > 0 && (
            <Card>
              <h3 style={{ marginTop: 0, fontSize: 14, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Bundle workflows ({bundleWorkflows.length})
              </h3>
              {bundleWorkflows.map(([id, b]) => (
                <div key={id} style={{ borderBottom: "1px solid var(--border)", padding: "0.5rem 0", fontSize: 13 }}>
                  <div><code>{id}</code> · {b.cycle_length} · owner <strong>{b.owner}</strong></div>
                  <div className="text-dim" style={{ fontSize: 11 }}>
                    {b.participating_agents.length} agents · KPIs: {b.kpis_moved.join(", ")}
                  </div>
                </div>
              ))}
            </Card>
          )}

          {routines.length > 0 && (
            <Card>
              <h3 style={{ marginTop: 0, fontSize: 14, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Scheduled routines ({routines.length})
              </h3>
              {routines.map(([name, cron]) => (
                <div key={name} style={{ borderBottom: "1px solid var(--border)", padding: "0.4rem 0", fontSize: 12 }}>
                  <code>{name}</code> <span className="text-dim">· {cron}</span>
                </div>
              ))}
            </Card>
          )}

          {t2patches.length > 0 && (
            <Card>
              <h3 style={{ marginTop: 0, fontSize: 14, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                T2 patches ({t2patches.length})
              </h3>
              {t2patches.map((p, i) => (
                <div key={i} style={{ borderBottom: "1px solid var(--border)", padding: "0.4rem 0", fontSize: 12 }}>
                  <strong>{p.agent_id}</strong> · {p.changed_fields.join(", ")}
                  <div className="text-dim" style={{ marginTop: 2 }}>{p.rationale}</div>
                  <div className="text-dim" style={{ fontSize: 10 }}>signal: {p.pillar_signal}</div>
                </div>
              ))}
            </Card>
          )}

          {manifest.dry_run_gates.length > 0 && (
            <Card>
              <h3 style={{ marginTop: 0, fontSize: 13, color: "var(--warning)" }}>
                🔒 Dry-run gates ({manifest.dry_run_gates.length}) — 14-day write suppression
              </h3>
              <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                {manifest.dry_run_gates.map((g) => <code key={g} style={{ marginRight: 8 }}>{g}</code>)}
              </div>
            </Card>
          )}
        </>
      )}

      <NavRow next={{ onClick: onComplete, label: "Continue → finalize" }} nextDisabled={busy || !manifest} />
    </div>
  );
}
