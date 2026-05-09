/** Wavex-os op-omega Fastify route registrar. Mounts all op-omega
 *  onboarding endpoints under /op-omega/onboarding/* against an existing
 *  Fastify instance.
 *
 *  Boundary side-effects applied at registration time:
 *  - PAPERCLIP_DATA_DIR points at $HOME/.wavex-os so plugin state lands
 *    inside the wavex root
 *  - OP_OMEGA_CLAUDE_BIN is set so tier-router T2 calls reach the operator's
 *    OAuth keychain (in dev) or the plain claude CLI (in prod) */

import type { FastifyInstance } from "fastify";
import { applyInferenceEnv } from "@wavex-os/inference-adapter";
import { applyStateBridge } from "./state-bridge.js";
import { registerPillarRoutes } from "./routes/pillars.js";
import { registerPhaseRoutes } from "./routes/phases.js";
import { registerProbeRoutes } from "./routes/probe.js";
import { registerInstanceRoutes } from "./routes/instance.js";
import { registerObservabilityRoutes } from "./routes/observability.js";
import { registerPillar5TestSendRoute } from "./routes/pillar5-test-send.js";
import { registerCredentialRoutes } from "./routes/credentials.js";

let bootstrapped = false;
function bootstrap(): void {
  if (bootstrapped) return;
  applyInferenceEnv();
  applyStateBridge();
  bootstrapped = true;
}

export function registerOpOmegaRoutes(app: FastifyInstance): void {
  bootstrap();
  registerPillarRoutes(app);
  registerPhaseRoutes(app);
  registerProbeRoutes(app);
  registerInstanceRoutes(app);
  registerObservabilityRoutes(app);
  registerPillar5TestSendRoute(app);
  registerCredentialRoutes(app);
}

export { applyStateBridge, getInstanceDir, getOnboardingDir, getWavexDataRoot } from "./state-bridge.js";
