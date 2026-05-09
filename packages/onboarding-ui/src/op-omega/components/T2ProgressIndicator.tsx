/** Shared progressive-enrichment indicator for Phase 2/3/4 T2 calls.
 *  Mirrors the Pillar 1 pattern — 5 stages, animated bar, advances on
 *  fixed timers while the request is in flight. Advisory only (server
 *  doesn't actually stream progress; gives the operator something useful
 *  to look at instead of a blank spinner for 30-60s). */

import { useEffect, useState } from "react";

interface PhaseConfig { delayMs: number; label: string; }

const PHASE_2_STAGES: PhaseConfig[] = [
  { delayMs: 0,     label: "Loading pillar context…" },
  { delayMs: 2000,  label: "Reviewing decision-matrix baseline…" },
  { delayMs: 6000,  label: "Cross-referencing your industry + GTM…" },
  { delayMs: 12_000, label: "Sharpening per-connector rationale…" },
  { delayMs: 20_000, label: "Finalizing manifest…" },
];

const PHASE_3_STAGES: PhaseConfig[] = [
  { delayMs: 0,     label: "Loading swarm baseline…" },
  { delayMs: 2000,  label: "Reading agent activation rules…" },
  { delayMs: 6000,  label: "Tailoring skill overlays per role…" },
  { delayMs: 12_000, label: "Validating topology…" },
  { delayMs: 20_000, label: "Finalizing manifest…" },
];

const PHASE_4_STAGES: PhaseConfig[] = [
  { delayMs: 0,     label: "Loading workflow templates…" },
  { delayMs: 2000,  label: "Reading active swarm + connectors…" },
  { delayMs: 6000,  label: "Patching on_fire sequences with operator signal…" },
  { delayMs: 14_000, label: "Adding escalation routes…" },
  { delayMs: 25_000, label: "Validating attribution + finalizing…" },
];

const STAGES_BY_PHASE: Record<"phase-2" | "phase-3" | "phase-4", PhaseConfig[]> = {
  "phase-2": PHASE_2_STAGES,
  "phase-3": PHASE_3_STAGES,
  "phase-4": PHASE_4_STAGES,
};

export function T2ProgressIndicator({
  active, phase,
}: {
  active: boolean;
  phase: "phase-2" | "phase-3" | "phase-4";
}) {
  const stages = STAGES_BY_PHASE[phase];
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!active) {
      setStep(0);
      return;
    }
    const timers = stages.map((p, i) =>
      window.setTimeout(() => setStep(i), p.delayMs),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [active, stages]);

  if (!active) return null;

  return (
    <div style={{
      padding: "0.75rem",
      background: "var(--bg)",
      border: "1px solid var(--border)",
      borderRadius: 4,
      marginBottom: "1rem",
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, marginBottom: "0.5rem", color: "var(--text-dim)" }}>
        ⟲ T2 enrichment running — {step + 1}/{stages.length}
      </div>
      <div style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden", marginBottom: "0.5rem" }}>
        <div style={{
          height: "100%",
          width: `${((step + 1) / stages.length) * 100}%`,
          background: "var(--accent)",
          transition: "width 0.5s ease-out",
        }} />
      </div>
      <ol style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 12 }}>
        {stages.map((p, i) => (
          <li key={i} style={{
            padding: "2px 0",
            color: i < step ? "var(--text)" : i === step ? "var(--accent)" : "var(--text-dim)",
            opacity: i > step ? 0.5 : 1,
          }}>
            {i < step ? "✓ " : i === step ? "⟲ " : "○ "}
            {p.label}
          </li>
        ))}
      </ol>
    </div>
  );
}
