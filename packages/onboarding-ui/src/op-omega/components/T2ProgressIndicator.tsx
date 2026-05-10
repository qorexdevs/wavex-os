/** T2 progress indicator — polls the wavex-claude-spawn.sh wrapper status
 *  to show REAL elapsed seconds + alive heartbeat instead of timer-based
 *  fake stages. Falls back to the static "Generating…" label if no wrapper
 *  status is available (e.g. apikey mode).
 *
 *  The wrapper writes start / 2s-heartbeat / complete events to
 *  ~/.wavex-os/state/inference-current.json when WAVEX_INFERENCE_TRACK=1
 *  (default in oauth/dev mode). The /api/inference/current endpoint surfaces
 *  it; we poll every 1500ms while `active`. */

import { useEffect, useState } from "react";

interface InferenceStatus {
  ok?: boolean;
  idle?: boolean;
  started_at_ms?: number;
  pid?: number;
  alive?: boolean;
  elapsed_ms?: number;
  live_elapsed_ms?: number;
  completed?: boolean;
  exit_code?: number;
  stale?: boolean;
  updated_at_ms?: number;
}

/** Soft per-phase ETAs in seconds — only used to size the progress bar.
 *  Real elapsed time is what we display; ETA is a visual reference. */
const ETA_SECONDS: Record<string, number> = {
  "phase-2": 60,
  "phase-3": 60,
  "phase-4": 75,
  "pillar-1": 120,
  finalize: 90,
};

export function T2ProgressIndicator({
  active, phase,
}: {
  active: boolean;
  phase: "phase-2" | "phase-3" | "phase-4" | "pillar-1" | "finalize";
}) {
  const [status, setStatus] = useState<InferenceStatus | null>(null);

  useEffect(() => {
    if (!active) {
      setStatus(null);
      return;
    }
    let alive = true;
    async function poll(): Promise<void> {
      try {
        const r = await fetch("/api/inference/current");
        const j = (await r.json()) as InferenceStatus;
        if (alive) setStatus(j);
      } catch { /* polling error — silent retry */ }
    }
    void poll();
    const id = setInterval(() => void poll(), 1500);
    return () => { alive = false; clearInterval(id); };
  }, [active]);

  if (!active) return null;

  const elapsedMs = status?.live_elapsed_ms ?? status?.elapsed_ms ?? 0;
  const elapsedSec = Math.max(0, Math.floor(elapsedMs / 1000));
  const etaSec = ETA_SECONDS[phase] ?? 60;
  const pct = Math.min(95, Math.round((elapsedSec / etaSec) * 100));
  const overEta = elapsedSec > etaSec;

  // States we render distinctly:
  const isIdle = !status || status.idle;
  const isAlive = status?.alive && !status.stale;
  const isCompleted = status?.completed;
  const isStale = status?.stale;

  let label: string;
  let barColor = "var(--accent)";
  if (isCompleted) {
    label = `✓ T2 completed in ${elapsedSec}s`;
    barColor = "var(--accent)";
  } else if (isStale) {
    label = `⚠ T2 process stale (no heartbeat in ${Math.floor((Date.now() - (status?.updated_at_ms ?? 0)) / 1000)}s)`;
    barColor = "var(--warning)";
  } else if (isAlive) {
    label = overEta
      ? `⟲ T2 generating · ${elapsedSec}s elapsed (longer than typical ${etaSec}s)`
      : `⟲ T2 generating · ${elapsedSec}s elapsed (≈${etaSec}s expected)`;
  } else if (isIdle) {
    label = `⟲ T2 starting…`;
  } else {
    label = `⟲ T2 generating…`;
  }

  return (
    <div style={{
      padding: "0.75rem",
      background: "var(--bg)",
      border: `1px solid ${isStale ? "var(--warning)" : "var(--border)"}`,
      borderRadius: 4,
      marginBottom: "1rem",
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: "0.5rem", color: isStale ? "var(--warning)" : "var(--text-dim)" }}>
        {label}
      </div>
      <div style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden", marginBottom: "0.25rem" }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          background: barColor,
          transition: "width 0.5s ease-out",
        }} />
      </div>
      {(isAlive || isCompleted) && status?.pid !== undefined && (
        <div className="text-dim" style={{ fontSize: 10, marginTop: "0.25rem" }}>
          claude pid {status.pid}{isCompleted && status?.exit_code !== undefined ? ` · exit ${status.exit_code}` : ""}
        </div>
      )}
    </div>
  );
}
