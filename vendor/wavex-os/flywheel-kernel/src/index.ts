/**
 * Operator Ω · flywheel-kernel public API.
 *
 * Primary consumption is library-mode: server code and onboarding's finalize
 * phase import `runMonteCarlo`, `couple`, `assessCriticality`, `bifurcate`
 * directly.
 */

export { couple } from "./coupling.js";
export type { CouplingOptions } from "./coupling.js";
export { assessCriticality } from "./criticality.js";
export type { CriticalityOptions } from "./criticality.js";
export { bifurcate } from "./bifurcation.js";
export type { BifurcationOptions } from "./bifurcation.js";
export { runMonteCarlo, simulateStrategy, simulateRun, selectMCModel } from "./monte-carlo/simulator.js";
export { STRATEGIES, getStrategy } from "./monte-carlo/strategies.js";

export type {
  KPISnapshot,
  CouplingResult,
  CriticalityResult,
  BifurcationInput,
  BifurcationResult,
  BundleId,
  BundleAllocation,
  StrategyId,
  StrategyDefinition,
  MonteCarloInput,
  MonteCarloRunResult,
  MonteCarloStrategyResult,
  MonteCarloReport,
  MCModelMode,
} from "./types.js";

export { BUNDLE_IDS, STRATEGY_IDS } from "./types.js";

export { default as manifest } from "./manifest.js";
export { default as worker } from "./worker.js";
