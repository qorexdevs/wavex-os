/** Refinement panel (Option C). Operator types guidance →
 *  "Analyze impact" runs T2 → proposed structural changes render as
 *  checkboxes per phase → operator picks subset → "Apply selected" persists
 *  + re-signs. Revert undoes the most recent refinement.
 *
 *  Lives below the MATERIALIZED card on the Materialize phase. */

import { useState } from "react";
import { opOmegaOnboardingApi, ApiError } from "../lib/api";
import { Card, P } from "../components/primitives";
import type { CompanyManifest } from "@op-omega/plugin-onboarding";

type AnalyzeChange = Awaited<ReturnType<typeof opOmegaOnboardingApi.analyzeRefinement>>["changes"][number];

interface Props {
  companyId: string;
  hasRefinementHistory: boolean;
  onManifestUpdated: (manifest: CompanyManifest, sha256: string) => void;
}

export function RefinementPanel({ companyId, hasRefinementHistory, onManifestUpdated }: Props) {
  const [guidance, setGuidance] = useState("");
  const [stage, setStage] = useState<"idle" | "analyzed" | "applied">("idle");
  const [busy, setBusy] = useState<"analyze" | "apply" | "revert" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [analyzeResult, setAnalyzeResult] = useState<{
    imprint_only: boolean;
    rationale_summary: string;
    changes: AnalyzeChange[];
    warnings: string[];
  } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [regenerateImprint, setRegenerateImprint] = useState(true);

  async function handleAnalyze(): Promise<void> {
    setBusy("analyze");
    setError(null);
    setAnalyzeResult(null);
    try {
      const r = await opOmegaOnboardingApi.analyzeRefinement({ companyId, operatorGuidance: guidance.trim() });
      setAnalyzeResult({
        imprint_only: r.imprint_only,
        rationale_summary: r.rationale_summary,
        changes: r.changes,
        warnings: r.warnings,
      });
      // Default-select every proposed change
      setSelectedIds(new Set(r.changes.map((c) => c.id)));
      setStage("analyzed");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function handleApply(): Promise<void> {
    if (!analyzeResult) return;
    setBusy("apply");
    setError(null);
    try {
      const selected = analyzeResult.changes.filter((c) => selectedIds.has(c.id));
      const r = await opOmegaOnboardingApi.applyRefinement({
        companyId,
        operatorGuidance: guidance.trim(),
        changes: selected,
        regenerateImprint,
      });
      onManifestUpdated(r.manifest, r.sha256);
      setStage("applied");
      // Clear analysis state — operator can run another refinement on top
      setAnalyzeResult(null);
      setSelectedIds(new Set());
      setGuidance("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function handleRevert(): Promise<void> {
    if (!confirm("Revert the most recent refinement? This restores the manifest to the snapshot taken before that refinement was applied.")) return;
    setBusy("revert");
    setError(null);
    try {
      await opOmegaOnboardingApi.revertRefinement({ companyId });
      // Trigger parent reload by refetching manifest via the existing API
      const m = await opOmegaOnboardingApi.getInstanceManifest(companyId);
      if (m.manifest) onManifestUpdated(m.manifest, m.manifest.signatures.manifest_hash);
      setStage("idle");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function toggleChange(id: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Card>
      <h3 style={{ marginTop: 0, fontSize: 13, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Refine the manifest
      </h3>
      <P>
        Type guidance about what to change. The system analyzes whether your guidance implies
        only prose updates or also structural changes (connectors, swarm, workflows). You see
        the proposed structural changes as checkboxes, pick which to apply, and the manifest
        is re-signed with audit history. Revert restores the previous snapshot.
      </P>

      <textarea
        value={guidance}
        onChange={(e) => setGuidance(e.target.value)}
        rows={3}
        placeholder="e.g. Emphasize the international distribution motion. Add observability for dealer-channel attribution. Use second-person voice in the imprint."
        style={{ width: "100%", marginBottom: "0.5rem" }}
        disabled={busy !== null}
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        <div className="text-dim" style={{ fontSize: 11 }}>
          {guidance.trim().length} chars
          {hasRefinementHistory && " · refinement history present"}
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {hasRefinementHistory && stage === "idle" && (
            <button type="button" className="secondary" onClick={() => void handleRevert()} disabled={busy !== null} style={{ fontSize: 12 }}>
              {busy === "revert" ? "Reverting…" : "↶ Revert last refinement"}
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleAnalyze()}
            disabled={busy !== null || guidance.trim().length < 3}
          >
            {busy === "analyze" ? "Analyzing…" : "Analyze impact"}
          </button>
        </div>
      </div>

      {error && <div style={{ marginTop: "0.5rem", color: "var(--warning)", fontSize: 12 }}>✗ {error}</div>}

      {stage === "applied" && (
        <div style={{ marginTop: "0.75rem", padding: "0.5rem", background: "var(--bg)", border: "1px solid var(--accent)", borderRadius: 4, fontSize: 12, color: "var(--accent)" }}>
          ✓ Applied. Manifest re-signed with new sha256. Below: the updated MATERIALIZED card.
        </div>
      )}

      {analyzeResult && stage === "analyzed" && (
        <div style={{ marginTop: "1rem" }}>
          <div style={{
            padding: "0.75rem",
            background: "var(--bg)",
            border: `1px solid ${analyzeResult.imprint_only ? "var(--text-dim)" : "var(--accent)"}`,
            borderRadius: 4,
            fontSize: 12,
            marginBottom: "0.75rem",
          }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              {analyzeResult.imprint_only
                ? "○ Imprint-only refinement (no structural changes proposed)"
                : `✦ Structural refinement — ${analyzeResult.changes.length} proposed change${analyzeResult.changes.length === 1 ? "" : "s"}`}
            </div>
            <div className="text-dim">{analyzeResult.rationale_summary}</div>
          </div>

          {analyzeResult.changes.length > 0 && (
            <div style={{ marginBottom: "0.75rem" }}>
              {Object.entries(groupChangesByPhase(analyzeResult.changes)).map(([phase, list]) => (
                <div key={phase} style={{ marginBottom: "0.75rem" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                    {phase} ({list.length})
                  </div>
                  {list.map((c) => (
                    <ChangeRow key={c.id} change={c} selected={selectedIds.has(c.id)} onToggle={() => toggleChange(c.id)} />
                  ))}
                </div>
              ))}
            </div>
          )}

          {analyzeResult.warnings.length > 0 && (
            <div style={{ marginBottom: "0.75rem", padding: "0.5rem", background: "var(--bg)", border: "1px solid var(--warning)", borderRadius: 4, fontSize: 11 }}>
              <strong style={{ color: "var(--warning)" }}>Analyze warnings:</strong>
              <ul style={{ margin: "0.25rem 0 0 1rem", padding: 0 }}>
                {analyzeResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.75rem" }}>
            <label style={{ fontSize: 12 }}>
              <input
                type="checkbox"
                checked={regenerateImprint}
                onChange={(e) => setRegenerateImprint(e.target.checked)}
                disabled={busy !== null}
              />{" "}
              Also regenerate imprint with this guidance
            </label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button type="button" className="secondary" onClick={() => { setStage("idle"); setAnalyzeResult(null); }} disabled={busy !== null} style={{ fontSize: 12 }}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleApply()}
                disabled={busy !== null || (selectedIds.size === 0 && !regenerateImprint)}
              >
                {busy === "apply"
                  ? "Applying…"
                  : selectedIds.size === 0
                    ? regenerateImprint ? "Apply imprint regen only" : "Nothing selected"
                    : `Apply ${selectedIds.size} change${selectedIds.size === 1 ? "" : "s"}${regenerateImprint ? " + regen imprint" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function groupChangesByPhase(changes: AnalyzeChange[]): Record<string, AnalyzeChange[]> {
  const groups: Record<string, AnalyzeChange[]> = {};
  for (const c of changes) {
    const phase =
      c.action === "connector_add" || c.action === "connector_promote" ? "Connectors"
      : c.action === "swarm_overlay" ? "Swarm"
      : "Workflows";
    (groups[phase] ??= []).push(c);
  }
  return groups;
}

function ChangeRow({ change, selected, onToggle }: { change: AnalyzeChange; selected: boolean; onToggle: () => void }) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        padding: "0.5rem",
        border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
        background: selected ? "var(--surface-2)" : "transparent",
        borderRadius: 4,
        marginBottom: 4,
        cursor: "pointer",
        fontSize: 12,
      }}
    >
      <input type="checkbox" checked={selected} onChange={onToggle} style={{ marginTop: 2 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600 }}>
          <ActionLabel change={change} />
        </div>
        <div className="text-dim" style={{ marginTop: 2 }}>{change.rationale}</div>
        {change.pillar_signal && (
          <div className="text-dim" style={{ fontSize: 10, marginTop: 2 }}>
            signal: <code>{change.pillar_signal}</code>
          </div>
        )}
      </div>
    </label>
  );
}

function ActionLabel({ change }: { change: AnalyzeChange }) {
  switch (change.action) {
    case "connector_add":
      return <>ADD <code>{change.connector_id}</code> to <code>{change.bucket}</code> ({change.priority})</>;
    case "connector_promote":
      return <>PROMOTE <code>{change.connector_id}</code> from <code>{change.from_bucket}</code> → <code>{change.to_bucket}</code></>;
    case "swarm_overlay":
      return <>UPDATE skill_overlay for <code>{change.slot}</code></>;
    case "workflow_task_add":
      return <>ADD task to <code>{change.slot}</code>: "{change.task?.task?.slice(0, 60)}…"</>;
    case "workflow_escalation_add":
      return <>ADD escalation in <code>{change.slot}</code>: <code>{change.on}</code> → <code>{change.to}</code></>;
    default:
      return <>{(change as { action: string }).action}</>;
  }
}
