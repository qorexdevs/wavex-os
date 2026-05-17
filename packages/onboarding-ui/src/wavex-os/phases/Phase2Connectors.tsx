/** Phase 2 — derived connector manifest. Upstream ConnectorManifest shape:
 *    required[], suggested[], deferred[], blocked_on_manual_approval[]
 *  Each entry has: id, priority (P-1..P2), rationale, status, dry_run?, composio? */

import { useEffect, useState } from "react";
import { wavexOsOnboardingApi, ApiError } from "../lib/api";
import type { ConnectorManifest, ConnectorEntry } from "@wavex-os/plugin-onboarding";
import { Card, H2, NavRow, P } from "../components/primitives";
import { T2ProgressIndicator } from "../components/T2ProgressIndicator";
import { AddConnectorWidget } from "../components/AddConnectorWidget";
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
      const r = await wavexOsOnboardingApi.generateConnector(companyId, skipInference);
      setManifest(r.manifest);
      setSource(r.source);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // On mount: try to LOAD existing manifest from disk first (back-navigation
  // case — operator already ran T2, no point burning 60-90s + tokens again).
  // Only generate if no manifest exists yet (first visit). Operator can
  // explicitly re-run via the "↻ Re-refine with T2" button below.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const loaded = await wavexOsOnboardingApi.loadConnector(companyId);
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

      {/* Add anything the derived manifest missed. The widget surfaces the
       *  MCP → OAuth → API-key hierarchy so the operator picks the
       *  lowest-friction path per tool. Adding hands off to the credential
       *  concierge, where the actual paste/OAuth capture happens. */}
      <div style={{ marginTop: "1.5rem" }}>
        <h3 style={{ fontSize: 14, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.6rem" }}>
          Add another tool
        </h3>
        <AddConnectorWidget
          companyId={companyId}
          onAdded={() => onComplete()}
        />
      </div>

      <NavRow next={{ onClick: onComplete, label: "Continue → swarm" }} nextDisabled={busy || !manifest} />
    </div>
  );
}
