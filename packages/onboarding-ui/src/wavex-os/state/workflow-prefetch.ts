/** Workflow prefetch helper — fires POST /wavex-os/onboarding/workflow-
 *  manifest as soon as the operator confirms the Swarm Studio, so the
 *  T2-enriched workflow generation happens IN PARALLEL with the Imprint
 *  Theater playback. By the time the operator hits the end of Act 3 and
 *  finalize runs, the workflow manifest is already on disk; the finalize
 *  route detects the freshness (see packages/wavex-os-server/src/routes/
 *  phases.ts) and reuses it instead of running its own deterministic
 *  regen.
 *
 *  Stores a singleton promise keyed by companyId so the shell can both
 *  fire-and-forget and later await it without double-firing. */

import { wavexOsOnboardingApi } from "../lib/api";
import type { WorkflowManifest } from "@wavex-os/plugin-onboarding";

interface PendingPrefetch {
  companyId: string;
  promise: Promise<WorkflowManifest>;
  startedAt: number;
}

let pending: PendingPrefetch | null = null;

/** Generate the workflow manifest with up to 3 attempts (1.5s, 3s backoff).
 *  Same transient-hub-blip protection as connector + swarm phases — a
 *  single timeout doesn't dead-end the wizard at the Imprint Theater. */
async function generateWithRetry(companyId: string, t0FastMode: boolean): Promise<WorkflowManifest> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await wavexOsOnboardingApi.generateWorkflow(companyId, { skipInference: t0FastMode });
      return r.manifest;
    } catch (e) {
      lastError = e;
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, attempt * 1500));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export function startWorkflowPrefetch(companyId: string, t0FastMode = false): Promise<WorkflowManifest> {
  if (pending && pending.companyId === companyId) {
    return pending.promise;
  }
  const promise = generateWithRetry(companyId, t0FastMode)
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
