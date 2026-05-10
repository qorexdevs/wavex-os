/** Re-exports the vendored tier-router's `route()` and `decide()`, with a
 *  pre-applied inference config for wavex-os. Plugin code that needs to call
 *  T2 should import from here rather than @op-omega/plugin-tier-router
 *  directly so the bin override is guaranteed.
 *
 *  The op-omega plugin imports `route` from @op-omega/plugin-tier-router
 *  (workspace dep) — for that import path we rely on applyInferenceEnv()
 *  being called once at server boot, which mutates OP_OMEGA_CLAUDE_BIN. */

import { route as tierRoute, decide, type TierRouterOptions, type TierRoutingRequest } from "@op-omega/plugin-tier-router";
import { applyInferenceEnv, getClaudeBin } from "./config.js";

let envApplied = false;
function ensureEnv(): void {
  if (!envApplied) {
    applyInferenceEnv();
    envApplied = true;
  }
}

export async function route(request: TierRoutingRequest, options: TierRouterOptions = {}) {
  ensureEnv();
  return tierRoute(request, { ...options, claudeBin: options.claudeBin ?? getClaudeBin() });
}

export { decide };
export type { TierRouterOptions, TierRoutingRequest };
