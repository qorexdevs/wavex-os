/** Phase 2 — derived connector manifest. Upstream ConnectorManifest shape:
 *    required[], suggested[], deferred[], blocked_on_manual_approval[]
 *  Each entry has: id, priority (P-1..P2), rationale, status, dry_run?, composio? */

import { useEffect, useState } from "react";
import { opOmegaOnboardingApi, ApiError } from "../lib/api";
import type { ConnectorManifest, ConnectorEntry } from "@op-omega/plugin-onboarding";
import { Card, H2, NavRow, P } from "../components/primitives";
import { T2ProgressIndicator } from "../components/T2ProgressIndicator";
import { isT0FastMode } from "../lib/dev-flags";

interface Props { companyId: string; onComplete: () => void; }

function ConnectorRow({ entry, bucket }: { entry: ConnectorEntry; bucket: string }) {
  const color = bucket === "required" ? "var(--warning)"
    : bucket === "suggested" ? "var(--accent)"
    : "var(--text-dim)";
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
        <span style={{ fontWeight: 600 }}>{entry.id}</span>
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color }}>
          {bucket} · {entry.priority}
        </span>
        <span className="text-dim" style={{ fontSize: 11 }}>· status: <code>{entry.status}</code></span>
        {entry.dry_run && <span style={{ fontSize: 11, color: "var(--warning)" }}>· DRY-RUN</span>}
      </div>
      <div className="text-dim" style={{ fontSize: 13, marginTop: "0.25rem" }}>{entry.rationale}</div>
      {entry.composio && (
        <div className="text-dim" style={{ fontSize: 11, marginTop: "0.25rem" }}>
          composio: connection={entry.composio.connection_id}
          {entry.composio.connected_at && ` · since ${entry.composio.connected_at.slice(0, 10)}`}
        </div>
      )}
    </Card>
  );
}

export function Phase2Connectors({ companyId, onComplete }: Props) {
  const [manifest, setManifest] = useState<ConnectorManifest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string>("");

  async function generate(skipInference = false): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const r = await opOmegaOnboardingApi.generateConnector(companyId, skipInference);
      setManifest(r.manifest);
      setSource(r.source);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // T2 refinement runs automatically on mount — no button click required.
  // The matrix baseline is computed server-side first; T2 then refines it
  // using your Pillar 1 enrichment (ICP, friction, differentiator, etc.) to
  // tighten per-connector rationale and add/promote based on evidence.
  // ?t0=1 URL flag forces T0-fast for dev / e2e speed.
  useEffect(() => { void generate(isT0FastMode()); }, [companyId]);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "2rem" }}>
      <H2>Phase 2 — Connectors</H2>
      <P>
        Derived from Pillars 1-5. <strong>Required</strong> connectors must be configured
        before materialize; <strong>suggested</strong> can be added later. T2 enrichment
        runs automatically — your Pillar 1 context (ICP, friction, differentiator) shapes
        the per-connector rationale + can add/promote based on evidence.
      </P>

      {error && <Card><p style={{ color: "var(--warning)", margin: 0 }}>✗ {error}</p></Card>}

      <T2ProgressIndicator active={busy} phase="phase-2" />

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
          {manifest.required.length > 0 && <h3 style={{ fontSize: 14, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Required</h3>}
          {manifest.required.map((e) => <ConnectorRow key={e.id} entry={e} bucket="required" />)}

          {manifest.suggested.length > 0 && <h3 style={{ fontSize: 14, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "1rem" }}>Suggested</h3>}
          {manifest.suggested.map((e) => <ConnectorRow key={e.id} entry={e} bucket="suggested" />)}

          {manifest.deferred.length > 0 && <h3 style={{ fontSize: 14, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "1rem" }}>Deferred</h3>}
          {manifest.deferred.map((e) => <ConnectorRow key={e.id} entry={e} bucket="deferred" />)}

          {manifest.blocked_on_manual_approval.length > 0 && (
            <Card>
              <strong style={{ color: "var(--warning)" }}>Blocked on manual approval:</strong>
              <ul style={{ margin: "0.25rem 0 0 1rem", padding: 0, fontSize: 13 }}>
                {manifest.blocked_on_manual_approval.map((b) => (
                  <li key={b.id}><code>{b.id}</code> — {b.reason}</li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      <NavRow next={{ onClick: onComplete, label: "Continue → swarm" }} nextDisabled={busy || !manifest} />
    </div>
  );
}
