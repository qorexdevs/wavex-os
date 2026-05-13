/** Imprint Theater — the second earned full-screen reveal. Plays three
 *  acts after /op-omega/onboarding/finalize returns:
 *    Act 1 (~8s): Monte Carlo race across 5 GTM strategies.
 *    Act 2 (~3s): Winner reveal with stat tiles.
 *    Act 3: Streaming imprint prose + expandable signed manifest.
 *
 *  While the finalize call is in flight (~1-3 min on a real T2 imprint),
 *  the theater shows a calm "preparing your launch" screen with the
 *  T2ProgressIndicator. Once the response arrives, Acts 1-3 play in
 *  sequence; the operator clicks "Let's launch" to advance to pricing. */

import { useEffect, useRef, useState } from "react";
import type { CompanyManifest, WorkflowManifest } from "@op-omega/plugin-onboarding";
import { opOmegaOnboardingApi, ApiError } from "../lib/api";
import { isT0FastMode } from "../lib/dev-flags";
import { T2ProgressIndicator } from "../components/T2ProgressIndicator";
import { MonteCarloRace, type MonteCarloReportLike } from "../components/MonteCarloRace";
import { StreamingText } from "../components/StreamingText";
import { RefinementPanel } from "../components/RefinementPanel";
import { WorkflowSummaryReveal } from "../components/WorkflowSummaryReveal";
import { WorkflowDetails } from "../components/WorkflowDetails";

interface Props {
  companyId: string;
  onLaunch: () => void;
}

interface FinalizeResult {
  manifest: CompanyManifest;
  sha256: string;
  source: "t2" | "fallback";
}

type Act = "preparing" | 1 | 2 | 3 | "ready";

const ACT1_MIN_MS = 8000;
const ACT2_MIN_MS = 3000;

export function ImprintTheater({ companyId, onLaunch }: Props) {
  const [result, setResult] = useState<FinalizeResult | null>(null);
  const [workflowManifest, setWorkflowManifest] = useState<WorkflowManifest | null>(null);
  const [mcReport, setMcReport] = useState<MonteCarloReportLike | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [act, setAct] = useState<Act>("preparing");
  const [showFullManifest, setShowFullManifest] = useState(false);
  const finalizeRanRef = useRef(false);

  // Fire workflow + finalize serially on mount. Workflow generation has
  // to happen with real T2 BEFORE finalize so the workflow manifest
  // reflects operator-specific tuning (t2_patches). Doing it here in the
  // Theater (rather than relying on a prefetch race from SwarmStudio's
  // confirm) makes the behavior deterministic: real T2 every time skip-
  // inference isn't set. The "Preparing your launch" screen stays up for
  // workflow + imprint combined.
  useEffect(() => {
    if (finalizeRanRef.current) return;
    finalizeRanRef.current = true;
    void (async () => {
      try {
        const skipInference = isT0FastMode();
        // Phase 4 — real T2 workflow generation (operator-specific patches).
        // bypassBudgetCheck:true skips the vendored generator's pre-flight
        // probe against Paperclip's budget plugin (port 3102), which isn't
        // running in the standalone wavex demo. The manifest's dry_run
        // gates still hold; only the upstream budget snapshot is bypassed.
        // Finalize will pick up the freshly-written manifest via its
        // 10-minute freshness check and skip its internal regen.
        // Capture the workflow manifest as soon as Phase 4 resolves so
        // the "Preparing your launch" screen can fade it in below the
        // progress indicator. Finalize still runs serially after; the
        // panel sits while it completes.
        const wfRes = await opOmegaOnboardingApi.generateWorkflow(companyId, {
          skipInference,
          bypassBudgetCheck: true,
        });
        setWorkflowManifest(wfRes.manifest);
        const r = await opOmegaOnboardingApi.finalize({
          companyId,
          skipInference,
        });
        setResult({ manifest: r.manifest, sha256: r.sha256, source: r.source });
        // Fetch the full MC report from disk (written by finalize) for the
        // 5-strategy race chart. Failure is non-fatal — Act 1 will skip.
        try {
          const mc = await opOmegaOnboardingApi.getMcReport(companyId);
          if (mc.ok && mc.report) setMcReport(mc.report);
        } catch { /* race chart will be skipped */ }
        setAct(1);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : (e as Error).message);
      }
    })();
  }, [companyId]);

  // Act 1 → 2 transition (after race finishes AND minimum display time).
  useEffect(() => {
    if (act !== 1) return;
    const id = window.setTimeout(() => setAct(2), ACT1_MIN_MS);
    return () => window.clearTimeout(id);
  }, [act]);

  // Act 2 → 3 transition (after stat-tile dwell).
  useEffect(() => {
    if (act !== 2) return;
    const id = window.setTimeout(() => setAct(3), ACT2_MIN_MS);
    return () => window.clearTimeout(id);
  }, [act]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 70,
      background: "#0a0a0c",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "2rem",
      overflowY: "auto",
    }}>
      {/* Top spacer collapses when content overflows so Act 3 stays scrollable. */}
      <div style={{ flex: "0 0 auto" }} />
      {error && <ErrorView error={error} />}

      {!error && act === "preparing" && (
        <div style={{ maxWidth: 520, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: "0.5rem" }}>
            Preparing your launch
          </div>
          <div className="text-dim" style={{ fontSize: 12, marginBottom: "1.5rem" }}>
            Running Monte Carlo simulations + drafting your imprint. ~1-3 minutes.
          </div>
          <T2ProgressIndicator active phase="finalize" />
          {workflowManifest && <WorkflowSummaryReveal manifest={workflowManifest} />}
        </div>
      )}

      {!error && act === 1 && result && mcReport && (
        <MonteCarloRace report={mcReport} />
      )}
      {!error && act === 1 && result && !mcReport && (
        <div className="text-dim" style={{ fontSize: 12 }}>Simulations complete…</div>
      )}

      {!error && act === 2 && result && (
        <WinnerReveal manifest={result.manifest} />
      )}

      {!error && act === 3 && result && (
        <ImprintAct
          companyId={companyId}
          manifest={result.manifest}
          workflowManifest={workflowManifest}
          sha256={result.sha256}
          source={result.source}
          showFullManifest={showFullManifest}
          onToggleManifest={() => setShowFullManifest((v) => !v)}
          onLaunch={onLaunch}
          onRefined={(manifest, sha256) => setResult({ manifest, sha256, source: "t2" })}
        />
      )}
    </div>
  );
}

function ErrorView({ error }: { error: string }) {
  return (
    <div style={{ maxWidth: 520, textAlign: "center" }}>
      <div style={{ color: "var(--warning)", fontWeight: 700, marginBottom: "0.5rem" }}>
        ✗ Couldn't finalize
      </div>
      <div className="text-dim" style={{ fontSize: 13 }}>{error}</div>
    </div>
  );
}

function WinnerReveal({ manifest }: { manifest: CompanyManifest }) {
  const w = manifest.mc_winner;
  if (!w) return null;
  const STRATEGY_LABELS: Record<string, string> = {
    RETENTION_FIRST: "Retention first",
    BALANCED: "Balanced",
    ACQUISITION_HEAVY: "Acquisition heavy",
    NARRATIVE_LED: "Narrative led",
    CAPITAL_EFFICIENT: "Capital efficient",
  };
  // Build a one-line, operator-readable rationale from the winner stats.
  // Falls back to the rationale string the simulator returned if present.
  const rationale = w.rationale && w.rationale.trim().length > 0
    ? w.rationale
    : `Highest expected compound growth (${(w.mean_mrr_growth * 100).toFixed(0)}%) at acceptable ruin risk (${(w.p_ruin * 100).toFixed(0)}%) for your stage.`;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1.5rem", maxWidth: 760 }}>
      <div className="text-dim" style={{ fontSize: 12 }}>Your path</div>
      <div style={{ fontSize: 42, fontWeight: 700, color: "var(--accent)", textAlign: "center" }}>
        {STRATEGY_LABELS[w.strategy_id] ?? w.strategy_id}
      </div>
      <div className="text-dim" style={{ fontSize: 12, textAlign: "center", maxWidth: 520, lineHeight: 1.5, marginTop: "-0.5rem" }}>
        {rationale}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "1rem", width: "100%" }}>
        <StatTile label="Mean MRR growth" value={`${(w.mean_mrr_growth * 100).toFixed(0)}%`} />
        <StatTile label="P(auto-catalytic)" value={`${(w.p_auto_catalytic * 100).toFixed(0)}%`} />
        <StatTile label="P(ruin)" value={`${(w.p_ruin * 100).toFixed(0)}%`} accent={w.p_ruin < 0.2 ? "good" : w.p_ruin > 0.4 ? "warn" : "neutral"} />
      </div>
    </div>
  );
}

const toggleButton: React.CSSProperties = {
  padding: "0.3rem 0.7rem",
  borderRadius: 4,
  background: "transparent",
  color: "var(--text-dim)",
  border: "1px solid var(--border)",
  fontSize: 11,
  cursor: "pointer",
};

function StatTile({ label, value, accent = "neutral" }: { label: string; value: string; accent?: "good" | "warn" | "neutral" }) {
  const color = accent === "good" ? "var(--accent)" : accent === "warn" ? "var(--warning)" : "var(--text)";
  return (
    <div style={{
      padding: "1rem",
      background: "#13131a",
      border: "1px solid var(--border)",
      borderRadius: 8,
      textAlign: "center",
    }}>
      <div className="text-dim" style={{ fontSize: 11, marginBottom: "0.25rem" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

interface ImprintActProps {
  companyId: string;
  manifest: CompanyManifest;
  workflowManifest: WorkflowManifest | null;
  sha256: string;
  source: "t2" | "fallback";
  showFullManifest: boolean;
  onToggleManifest: () => void;
  onLaunch: () => void;
  onRefined: (manifest: CompanyManifest, sha256: string) => void;
}

function ImprintAct({ companyId, manifest, workflowManifest, sha256, source, showFullManifest, onToggleManifest, onLaunch, onRefined }: ImprintActProps) {
  const imprint = manifest.imprint_summary ?? "";
  const [streamDone, setStreamDone] = useState(false);
  const [refineMode, setRefineMode] = useState(false);
  const [showWorkflow, setShowWorkflow] = useState(false);
  return (
    <div style={{ maxWidth: 720, width: "100%", display: "flex", flexDirection: "column", gap: "1.5rem", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.35rem" }}>
        <div style={{
          fontSize: 11,
          color: "var(--text-dim)",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          fontWeight: 600,
        }}>
          Your imprint
        </div>
        {source === "fallback" && (
          <span style={{ color: "var(--warning)", fontSize: 11 }}>(quick draft)</span>
        )}
      </div>
      <div style={{
        fontSize: 16,
        lineHeight: 1.75,
        color: "var(--text)",
        padding: "0 0.25rem",
        wordBreak: "break-word",
        overflowWrap: "anywhere",
        width: "100%",
        // White-space pre-line so paragraph breaks ('\n\n') in the imprint
        // render with proper spacing instead of collapsing to a wall.
        whiteSpace: "pre-line",
        // A subtle left rail visually separates the imprint from the buttons
        // below and signals "this is the artifact."
        borderLeft: "2px solid color-mix(in srgb, var(--accent) 40%, transparent)",
        paddingLeft: "1.25rem",
      }}>
        {/* key forces StreamingText to remount when the imprint changes
         *  (e.g. operator applied a refinement that regenerated the imprint),
         *  re-starting the character-by-character reveal from the top. */}
        <StreamingText key={sha256} text={imprint} charsPerSec={60} onComplete={() => setStreamDone(true)} />
      </div>
      <div style={{ textAlign: "center", marginTop: "0.5rem", display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={onToggleManifest}
          style={toggleButton}
        >
          {showFullManifest ? "Hide" : "Read"} the full signed manifest
        </button>
        {workflowManifest && (
          <button
            type="button"
            onClick={() => setShowWorkflow((v) => !v)}
            style={toggleButton}
          >
            {showWorkflow ? "Hide" : "Read"} the workflow manifest
          </button>
        )}
      </div>
      {showFullManifest && (
        <pre style={{
          fontSize: 10,
          background: "#101015",
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: "0.75rem",
          maxHeight: 220,
          overflow: "auto",
          color: "var(--text-dim)",
        }}>
          <div style={{ marginBottom: "0.5rem", color: "var(--accent)" }}>sha256: {sha256}</div>
          {JSON.stringify(manifest, null, 2)}
        </pre>
      )}
      {showWorkflow && workflowManifest && (
        <WorkflowDetails manifest={workflowManifest} />
      )}
      {refineMode && streamDone && (
        <RefinementPanel
          companyId={companyId}
          onApplied={(m, s) => {
            onRefined(m, s);
            setRefineMode(false);
            // StreamingText is keyed on sha256 — if the manifest actually
            // changed, it remounts and re-runs the stream from scratch.
            // We don't force streamDone=false here because empty-changes
            // applies don't alter the imprint, and forcing it would lock
            // the Launch button when nothing's actually re-streaming.
          }}
          onSkip={() => setRefineMode(false)}
        />
      )}

      {!refineMode && (
        <div style={{ textAlign: "center", marginTop: "0.5rem", display: "flex", gap: "0.75rem", justifyContent: "center" }}>
          <button
            type="button"
            onClick={() => setRefineMode(true)}
            disabled={!streamDone}
            style={{
              padding: "0.55rem 1rem",
              borderRadius: 8,
              background: "transparent",
              color: "var(--text-dim)",
              border: "1px solid var(--border)",
              fontSize: 13,
              cursor: streamDone ? "pointer" : "wait",
              opacity: streamDone ? 1 : 0.5,
            }}
          >
            Refine before launch
          </button>
          <button
            type="button"
            onClick={onLaunch}
            disabled={!streamDone}
            style={{
              padding: "0.7rem 1.4rem",
              borderRadius: 8,
              background: "var(--accent)",
              color: "var(--bg)",
              border: "none",
              fontWeight: 700,
              fontSize: 14,
              cursor: streamDone ? "pointer" : "wait",
              opacity: streamDone ? 1 : 0.5,
            }}
          >
            Let's launch →
          </button>
        </div>
      )}
    </div>
  );
}
