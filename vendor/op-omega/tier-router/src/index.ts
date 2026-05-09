/**
 * Operator Ω · tier-router public API.
 *
 * Consumed in two ways:
 *   (1) As a library — server code imports `route()` or `decide()` directly.
 *   (2) As a Paperclip plugin — installed into an Omega instance; exposes a
 *       `decide` data handler for UI probes.
 */

export { decide, route } from "./router.js";
export type {
  Tier,
  TierRuntime,
  TaskPriority,
  ReasoningDepth,
  TaskMetadata,
  TierRoutingRequest,
  TierRoutingResponse,
  TierRoutingCost,
  BudgetSnapshot,
  TierRouterOptions,
} from "./types.js";
export {
  fetchBudgetSnapshot,
  fetchBudgetSnapshotResult,
  fetchBudgetSnapshotWithRetry,
  type BudgetClientResult,
} from "./budget-client.js";
export { invokeOllama } from "./runtimes/t1-ollama.js";
export { invokeClaudeCode } from "./runtimes/t2-claude-code.js";

export { default as manifest } from "./manifest.js";
export { default as worker } from "./worker.js";
