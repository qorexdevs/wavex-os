/**
 * Operator Ω · onboarding public API. Consumed in library mode by
 * `server/src/routes/wavex-os-onboarding.ts`.
 */

// Explicit halt errors the pipeline raises when prerequisites are missing.
export { OnboardingHaltError, isOnboardingHaltError } from "./errors.js";
export type { OnboardingHaltCode, OnboardingHaltPayload } from "./errors.js";

// Inter-pillar transition inference.
export { runPillarTransition } from "./inference/pillar-transition.js";
export type { PillarTransitionResult, QuestionModification, PillarNumber } from "./inference/pillar-transition.js";

// Pillar handlers
export { handlePillar1, looksLikeNoProduct } from "./phases/phase-1-onboard/pillar-1.js";
export type { Pillar1Input } from "./phases/phase-1-onboard/pillar-1.js";
export { handlePillar2 } from "./phases/phase-1-onboard/pillar-2.js";
export type { Pillar2Input, Pillar2Outcome } from "./phases/phase-1-onboard/pillar-2.js";
export { handlePillar3 } from "./phases/phase-1-onboard/pillar-3.js";
export type { Pillar3Input } from "./phases/phase-1-onboard/pillar-3.js";
export { handlePillar4, deriveGtmProfile } from "./phases/phase-1-onboard/pillar-4.js";
export type { Pillar4Input } from "./phases/phase-1-onboard/pillar-4.js";
export { handlePillar5 } from "./phases/phase-1-onboard/pillar-5.js";
export type { Pillar5Input } from "./phases/phase-1-onboard/pillar-5.js";

// System check (exposed for Pillar 2 refresh + UI probes)
export { probeClaudeCode } from "./claude-code-check.js";
export type { ClaudeCodeProbe, ClaudeCodeCheckOptions } from "./claude-code-check.js";

// Session state
export {
  sessionPaths,
  loadPillarResponses,
  savePillarResponses,
  updatePillar,
  ensureOnboardingDir,
  writeArtifact,
} from "./state/session.js";

// Schemas
export {
  PILLAR_RESPONSES_SCHEMA_VERSION,
  emptyPillarResponses,
  isPillarResponsesComplete,
  nextIncompletePillar,
} from "./schema/pillar-responses.js";
export type {
  PillarResponses,
  Pillar1Response,
  Pillar2Response,
  Pillar3Response,
  Pillar4Response,
  Pillar5Response,
  ClaudePlan,
  InferenceBudgetProfile,
  ProductState,
  LeadSource,
  SalesMotion,
  CloseChannel,
  GtmProfileEnum,
  CommChannel,
  UrgencyRouting,
} from "./schema/pillar-responses.js";

// Phase 2
export { runDecisionMatrix } from "./phases/phase-2-connector/decision-matrix.js";
export { generateConnectorManifest } from "./phases/phase-2-connector/generate.js";
export type {
  GenerateConnectorManifestInput,
  GenerateConnectorManifestResult,
} from "./phases/phase-2-connector/generate.js";
export {
  CONNECTOR_MANIFEST_SCHEMA_VERSION,
} from "./schema/connector-manifest.js";
export type {
  ConnectorManifest,
  ConnectorEntry,
  BlockedEntry,
  ConnectorPriority,
  ConnectorEntryStatus,
} from "./schema/connector-manifest.js";

// Phase 3
export {
  runSwarmDecisionMatrix,
  hashConnectorManifest,
} from "./phases/phase-3-swarm/decision-matrix.js";
export { generateSwarmManifest, loadConnectorManifest } from "./phases/phase-3-swarm/generate.js";
export type {
  GenerateSwarmManifestInput,
  GenerateSwarmManifestResult,
} from "./phases/phase-3-swarm/generate.js";
export { BASE_ROSTER, BASE_ROSTER_SIZE } from "./phases/phase-3-swarm/base-roster.js";
export {
  SWARM_MANIFEST_SCHEMA_VERSION,
} from "./schema/swarm-manifest.js";
export type {
  SwarmManifest,
  AgentManifestEntry,
  AgentStatus,
  AgentLevel,
  AgentDepartment,
  SpawnEligibilityEntry,
  SwarmTopologySummary,
} from "./schema/swarm-manifest.js";

// Phase 4
export {
  runWorkflowDecisionMatrix,
  hashSwarmManifest,
} from "./phases/phase-4-workflow/decision-matrix.js";
export { generateWorkflowManifest, loadSwarmManifest } from "./phases/phase-4-workflow/generate.js";
export type {
  GenerateWorkflowManifestInput,
  GenerateWorkflowManifestResult,
} from "./phases/phase-4-workflow/generate.js";
export { SCHEDULED_ROUTINES } from "./phases/phase-4-workflow/scheduled-routines.js";
export {
  CANONICAL_BUNDLE_WORKFLOWS,
  bundleWorkflowsForSwarm,
} from "./phases/phase-4-workflow/bundle-workflows.js";
export {
  WORKFLOW_MANIFEST_SCHEMA_VERSION,
} from "./schema/workflow-manifest.js";
export type {
  WorkflowManifest,
  WorkflowTier,
  FlowType,
  WorkflowTask,
  AgentWorkflow,
  BundleWorkflow,
  EscalationTrigger,
} from "./schema/workflow-manifest.js";

// Finalize
export { invokeMonteCarlo } from "./phases/finalize/mc-invocation.js";
export type { McInvocationOptions, McInvocationResult } from "./phases/finalize/mc-invocation.js";
export { generateImprintReview } from "./phases/finalize/imprint-review.js";
export { assembleCompanyManifest, computeManifestHash } from "./phases/finalize/assemble.js";
export type {
  AssembleCompanyManifestInput,
  AssembleResult,
} from "./phases/finalize/assemble.js";
export { COMPANY_MANIFEST_SCHEMA_VERSION } from "./schema/company-manifest.js";
export type {
  CompanyManifest,
  MonteCarloWinner,
  DryRunState,
  CompanyManifestSignatures,
  PhaseTimings,
} from "./schema/company-manifest.js";

// Plugin shell
export { default as manifest } from "./manifest.js";
export { default as worker } from "./worker.js";
