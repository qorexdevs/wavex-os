/** T2 progress indicator — polls the wavex-claude-spawn.sh wrapper status
 *  to show REAL elapsed seconds + alive heartbeat. The visible label is a
 *  human narrator ("Reading your site", "Mapping your industry", etc.)
 *  driven by elapsed time so non-technical operators see what's happening
 *  in their language. Technical detail (T2 phase code, PID, exact median
 *  ETA, exit code) hides behind a small "•••" toggle for ops/dev. */

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

interface PhaseEta {
  median_ms: number;
  p90_ms: number;
  samples: number;
  is_default: boolean;
}

type PhaseKey = "pillar-1" | "phase-2" | "phase-3" | "phase-4" | "finalize" | "avatar-voice";

/** Map UI phase keys → server PhaseKey used by the eta endpoint. */
const PHASE_TO_SERVER_KEY: Record<string, string> = {
  "pillar-1": "pillar_1",
  "phase-2": "connector_manifest",
  "phase-3": "swarm_manifest",
  "phase-4": "workflow_manifest",
  finalize: "finalize",
  "avatar-voice": "avatar_voice",
};

/** Per-phase activity narration table. The label rotates as elapsed time
 *  crosses each `untilSec` threshold. These aren't guesses about what the
 *  model is internally doing — they're honest human descriptions of what
 *  the operator is waiting on, distributed across the median window.
 *
 *  Calibrated so the first label shows ~30% of the median, the middle two
 *  cover the middle, and the last label sits at >85% until the call ends. */
const PHASE_NARRATION: Record<PhaseKey, string[]> = {
  "pillar-1": [
    "Reading your site",
    "Figuring out what you do",
    "Spotting your ideal customer",
    "Pulling it together",
  ],
  "phase-2": [
    "Matching your stack",
    "Picking the right integrations",
    "Cross-checking what plugs in where",
    "Almost ready",
  ],
  "phase-3": [
    "Drafting your team",
    "Wiring reporting lines",
    "Setting heartbeats and budgets",
    "Almost ready",
  ],
  "phase-4": [
    "Mapping your daily routines",
    "Tuning per-agent playbooks",
    "Finalizing escalation rules",
    "Almost ready",
  ],
  "finalize": [
    "Running simulations",
    "Picking your winning strategy",
    "Writing your imprint",
    "Signing the manifest",
  ],
  "avatar-voice": [
    "Reading how you write",
    "Picking up your tone",
    "Spotting what you delegate first",
    "Wrapping up your profile",
  ],
};

function narrationFor(phase: PhaseKey, elapsedSec: number, medianSec: number): string {
  const table = PHASE_NARRATION[phase];
  // Thresholds split the median into quartiles (30% / 60% / 85% / 100%).
  // Past 100% of median we hold the last label rather than wrap.
  const t1 = Math.max(8, medianSec * 0.30);
  const t2 = Math.max(t1 + 5, medianSec * 0.60);
  const t3 = Math.max(t2 + 5, medianSec * 0.85);
  if (elapsedSec < t1) return table[0];
  if (elapsedSec < t2) return table[1];
  if (elapsedSec < t3) return table[2];
  return table[3];
}

function humanRemaining(remainingSec: number): string {
  if (remainingSec <= 0) return "wrapping up";
  if (remainingSec < 10) return "a few seconds left";
  if (remainingSec < 30) return "under 30 seconds";
  if (remainingSec < 90) return "about a minute";
  if (remainingSec < 180) return "a couple of minutes";
  return "a few minutes";
}

export function T2ProgressIndicator({
  active, phase,
}: {
  active: boolean;
  phase: PhaseKey;
}) {
  const [status, setStatus] = useState<InferenceStatus | null>(null);
  const [eta, setEta] = useState<PhaseEta | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Fetch the historical ETA once when this phase activates.
  useEffect(() => {
    if (!active) return;
    const serverPhase = PHASE_TO_SERVER_KEY[phase] ?? phase;
    let alive = true;
    void fetch(`/api/inference/eta?phase=${encodeURIComponent(serverPhase)}`)
      .then((r) => r.json())
      .then((j: { ok: boolean; eta?: PhaseEta }) => {
        if (alive && j.eta) setEta(j.eta);
      })
      .catch(() => { /* silent — falls back to default */ });
    return () => { alive = false; };
  }, [active, phase]);

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
  const etaSec = Math.max(1, Math.round((eta?.median_ms ?? 60_000) / 1000));
  const p90Sec = Math.max(etaSec, Math.round((eta?.p90_ms ?? etaSec * 1500) / 1000));
  const pct = Math.min(95, Math.round((elapsedSec / etaSec) * 100));
  const overP90 = elapsedSec > p90Sec;
  const remainingSec = Math.max(0, etaSec - elapsedSec);

  const isIdle = !status || status.idle;
  const isAlive = status?.alive && !status.stale;
  const isCompleted = status?.completed;
  const isStale = status?.stale;

  // Human-facing label — what's happening, in operator language.
  let humanLabel: string;
  let barColor = "var(--accent)";
  let dotColor = "var(--accent)";
  if (isCompleted) {
    humanLabel = "Done";
  } else if (isStale) {
    humanLabel = "Looks stuck — checking on it";
    barColor = "var(--warning)";
    dotColor = "var(--warning)";
  } else if (isAlive || isIdle) {
    humanLabel = narrationFor(phase, elapsedSec, etaSec);
    if (overP90) {
      humanLabel = `${humanLabel} (taking longer than usual)`;
      barColor = "var(--warning)";
    }
  } else {
    humanLabel = "Working on it";
  }

  // Right-hand soft estimate. Before first poll resolves (no status yet) show
  // explicit "~60–90 s" so operators know what they're waiting for from the
  // first render rather than only after the polling loop has data.
  const rightSide = isCompleted ? `${elapsedSec}s`
    : isStale ? ""
    : !status ? "~60–90 s"
    : humanRemaining(remainingSec);

  // Server-side phase label (technical) used in the details drawer.
  const serverPhaseLabel = PHASE_TO_SERVER_KEY[phase] ?? phase;
  const etaSrc = eta && !eta.is_default
    ? `from ${eta.samples} prior call${eta.samples === 1 ? "" : "s"}`
    : "default — no history yet";

  return (
    <div style={{
      padding: "0.75rem 0.85rem",
      background: "var(--bg)",
      border: `1px solid ${isStale ? "var(--warning)" : "var(--border)"}`,
      borderRadius: 6,
      marginBottom: "1rem",
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "0.6rem",
        marginBottom: "0.5rem",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0, flex: 1 }}>
          <span
            aria-hidden
            className={!isCompleted && !isStale ? "wavex-pulse-dot" : ""}
            style={{
              flex: "0 0 auto",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: dotColor,
              boxShadow: !isCompleted && !isStale ? `0 0 8px ${dotColor}` : "none",
            }}
          />
          <span style={{
            fontSize: 13,
            color: isStale ? "var(--warning)" : "var(--text)",
            fontWeight: 500,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {humanLabel}
          </span>
        </div>
        {rightSide && (
          <span className="text-dim" style={{ fontSize: 12, flex: "0 0 auto" }}>
            {rightSide}
          </span>
        )}
      </div>
      <div style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${isCompleted ? 100 : pct}%`,
          background: barColor,
          transition: "width 0.5s ease-out",
        }} />
      </div>

      {/* Technical detail — collapsed by default, toggle via "•••" */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.4rem" }}>
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          aria-label={showDetails ? "Hide technical detail" : "Show technical detail"}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-dim)",
            fontSize: 11,
            cursor: "pointer",
            padding: "0.1rem 0.3rem",
            letterSpacing: "0.1em",
          }}
        >
          {showDetails ? "− hide" : "•••"}
        </button>
      </div>
      {showDetails && (
        <div className="text-dim" style={{
          fontSize: 10,
          marginTop: "0.25rem",
          lineHeight: 1.55,
          fontFamily: "ui-monospace, SF Mono, monospace",
        }}>
          <div>phase: {serverPhaseLabel}</div>
          <div>elapsed: {elapsedSec}s · remaining: ~{remainingSec}s</div>
          <div>median: {etaSec}s · p90: {p90Sec}s · {etaSrc}</div>
          {status?.pid !== undefined && (
            <div>
              claude pid {status.pid}
              {isCompleted && status?.exit_code !== undefined ? ` · exit ${status.exit_code}` : ""}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
