/** Inline connector picker card.
 *
 *  Renders the three buckets returned by /op-omega/onboarding/connector-
 *  manifest (required / suggested / deferred) with per-entry rationale.
 *  A single CTA advances to the credential drawer. The operator can also
 *  re-refine via T2 if the proposed manifest doesn't fit. */

import { useState } from "react";
import type { ConnectorManifest } from "@op-omega/plugin-onboarding";
import { opOmegaOnboardingApi, ApiError } from "../../lib/api";

interface Props {
  companyId: string;
  manifest: ConnectorManifest;
  onConfirmed: () => void;
  onReRefined: (manifest: ConnectorManifest) => void;
}

export function ConnectorPickerCard({ companyId, manifest, onConfirmed, onReRefined }: Props) {
  const [busy, setBusy] = useState<"none" | "refine">("none");
  const [error, setError] = useState<string | null>(null);

  async function handleRefine(): Promise<void> {
    setBusy("refine");
    setError(null);
    try {
      const result = await opOmegaOnboardingApi.generateConnector(companyId, false);
      onReRefined(result.manifest);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusy("none");
    }
  }

  const totalReq = manifest.required.length;
  const totalSug = manifest.suggested.length;
  const totalDef = manifest.deferred.length;

  return (
    <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.8rem" }}>
      <Bucket title={`Required · ${totalReq}`} entries={manifest.required} accent />
      {totalSug > 0 && <Bucket title={`Suggested · ${totalSug}`} entries={manifest.suggested} />}
      {totalDef > 0 && <Bucket title={`Deferred · ${totalDef}`} entries={manifest.deferred} />}

      {error && (
        <div style={{ color: "var(--warning)", fontSize: 12 }}>✗ {error}</div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.25rem" }}>
        <button
          type="button"
          onClick={() => void handleRefine()}
          disabled={busy !== "none"}
          style={{
            padding: "0.35rem 0.7rem",
            borderRadius: 6,
            background: "transparent",
            color: "var(--text-dim)",
            border: "1px solid var(--border)",
            fontSize: 11,
            cursor: busy !== "none" ? "wait" : "pointer",
          }}
        >
          {busy === "refine" ? "Re-refining…" : "↻ Re-refine"}
        </button>
        <button
          type="button"
          onClick={onConfirmed}
          disabled={busy !== "none"}
          style={{
            padding: "0.4rem 0.85rem",
            borderRadius: 6,
            background: "var(--accent)",
            color: "var(--bg)",
            border: "none",
            fontWeight: 600,
            fontSize: 12,
            cursor: busy !== "none" ? "not-allowed" : "pointer",
            opacity: busy !== "none" ? 0.6 : 1,
          }}
        >
          These look right — plug them in →
        </button>
      </div>
    </div>
  );
}

function Bucket({
  title, entries, accent = false,
}: {
  title: string;
  entries: ConnectorManifest["required"];
  accent?: boolean;
}) {
  return (
    <div style={{
      padding: "0.55rem 0.7rem",
      background: "var(--bg)",
      border: `1px solid ${accent ? "var(--accent)" : "var(--border)"}`,
      borderRadius: 6,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: accent ? "var(--accent)" : "var(--text-dim)", marginBottom: "0.4rem" }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        {entries.map((e) => (
          <div key={e.id} style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: "0.15rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.5rem" }}>
              <code style={{ fontSize: 11, fontWeight: 600 }}>{e.id}</code>
              <span className="text-dim" style={{ fontSize: 10 }}>{e.priority}{e.dry_run ? " · dry-run" : ""}</span>
            </div>
            <div className="text-dim" style={{ fontSize: 11, lineHeight: 1.4 }}>{e.rationale}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
