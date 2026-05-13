/** Workflow prefetch helper — fires POST /op-omega/onboarding/workflow-
 *  manifest as soon as the operator confirms the Swarm Studio, so the
 *  T2-enriched workflow generation happens IN PARALLEL with the Imprint
 *  Theater playback. By the time the operator hits the end of Act 3 and
 *  finalize runs, the workflow manifest is already on disk; the finalize
 *  route detects the freshness (see packages/op-omega-server/src/routes/
 *  phases.ts) and reuses it instead of running its own deterministic
 *  regen.
 *
 *  Stores a singleton promise keyed by companyId so the shell can both
 *  fire-and-forget and later await it without double-firing. */

import { opOmegaOnboardingApi } from "../lib/api";
import type { WorkflowManifest } from "@op-omega/plugin-onboarding";

interface PendingPrefetch {
  companyId: string;
  promise: Promise<WorkflowManifest>;
  startedAt: number;
}

let pending: PendingPrefetch | null = null;

export function startWorkflowPrefetch(companyId: string, t0FastMode = false): Promise<WorkflowManifest> {
  if (pending && pending.companyId === companyId) {
    return pending.promise;
  }
  const promise = opOmegaOnboardingApi.generateWorkflow(companyId, { skipInference: t0FastMode })
    .then((r) => r.manifest)
    .catch((err) => {
      pending = null;
      throw err;
    });
  pending = { companyId, promise, startedAt: Date.now() };
  return promise;
}

export function getWorkflowPrefetch(companyId: string): PendingPrefetch | null {
  return pending && pending.companyId === companyId ? pending : null;
}

export function clearWorkflowPrefetch(): void {
  pending = null;
}
