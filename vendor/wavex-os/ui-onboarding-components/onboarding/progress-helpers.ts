/**
 * Helpers for the onboarding progress display: derive a human-readable phase
 * label + a rough estimate of remaining time. Estimates are intentionally
 * coarse — they reflect typical operator pace through each step, not strict
 * deadlines.
 */

import type { NextPillar } from "../../../api/wavexOsOnboarding";

export type OnboardingPhase =
  | 1
  | 2
  | 3
  | 4
  | "composio_bootstrap"
  | "connector_pick"
  | "direct_credentials"
  | "connector"
  | "swarm"
  | "workflow"
  | "kpi_verify"
  | "finalize"
  | "materialize"
  | "done";

interface PhaseInfo {
  /** Human-readable label shown beneath the progress bar. */
  label: string;
  /** Approximate minutes remaining from this point through cycle close. */
  minutesRemaining: number;
  /** Step index (1-based) used for "Step N of M" display. */
  stepIndex: number;
}

// Step labels follow the PHASE_LABELS family ("Wiring your tools", etc.) and
// drop developer-facing internal jargon ("Pillar 2 · Inference bootstrap")
// in favor of operator-narrative language. Single source of truth for the
// "Step N of 14 · {label}" pattern shown beneath the progress bar AND the
// step-dot pills above it.
const PHASE_INFO: Record<string, PhaseInfo> = {
  pillar_1: { label: "Step 1 of 14 · Who you are", minutesRemaining: 16, stepIndex: 1 },
  pillar_2: { label: "Step 2 of 14 · Verifying your setup", minutesRemaining: 14, stepIndex: 2 },
  pillar_3: { label: "Step 3 of 14 · Your product & stage", minutesRemaining: 12, stepIndex: 3 },
  pillar_4: { label: "Step 4 of 14 · How you go to market", minutesRemaining: 9, stepIndex: 4 },
  pillar_5: { label: "Step 5 of 14 · How your team stays in the loop", minutesRemaining: 7, stepIndex: 5 },
  inference_preview: { label: "Confirm inferred signals", minutesRemaining: 9, stepIndex: 2 },
  composio_bootstrap: { label: "Step 6 of 14 · Connecting your tool hub", minutesRemaining: 8, stepIndex: 6 },
  connector_pick: { label: "Step 7 of 14 · Wiring your tools", minutesRemaining: 6, stepIndex: 7 },
  direct_credentials: { label: "Step 8 of 14 · Direct credentials", minutesRemaining: 5, stepIndex: 8 },
  connector: { label: "Step 9 of 14 · Reviewing your tool plan", minutesRemaining: 4, stepIndex: 9 },
  swarm: { label: "Step 10 of 14 · Assembling your team", minutesRemaining: 4, stepIndex: 10 },
  workflow: { label: "Step 11 of 14 · Mapping your workflows", minutesRemaining: 3, stepIndex: 11 },
  kpi_verify: { label: "Step 12 of 14 · Confirming your numbers", minutesRemaining: 3, stepIndex: 12 },
  finalize: { label: "Step 13 of 14 · Reviewing your strategy", minutesRemaining: 2, stepIndex: 13 },
  materialize: { label: "Step 14 of 14 · Bringing your team online", minutesRemaining: 1, stepIndex: 14 },
  done: { label: "Setup complete", minutesRemaining: 0, stepIndex: 14 },
};

export function describePhase(phase: OnboardingPhase, nextPillar: NextPillar): PhaseInfo {
  if (phase === 1 || phase === 2 || phase === 3 || phase === 4) {
    if (nextPillar === 1) return PHASE_INFO.pillar_1;
    if (nextPillar === 2) return PHASE_INFO.pillar_2;
    if (nextPillar === 3) return PHASE_INFO.pillar_3;
    if (nextPillar === 4) return PHASE_INFO.pillar_4;
    if (nextPillar === 5) return PHASE_INFO.pillar_5;
    return PHASE_INFO.pillar_1;
  }
  return PHASE_INFO[phase] ?? PHASE_INFO.done;
}

export function formatTimeRemaining(minutes: number): string {
  if (minutes <= 0) return "Almost there";
  if (minutes === 1) return "~1 min left";
  return `~${minutes} min left`;
}
