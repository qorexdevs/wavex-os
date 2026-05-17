/**
 * Finalize step — assembles the final `company.manifest.yaml` from all 4
 * prior manifests + MC winner + imprint summary.
 */

import { createHash, randomUUID } from "node:crypto";
import yaml from "js-yaml";
import type { PillarResponses } from "../../schema/pillar-responses.js";
import type { ConnectorManifest } from "../../schema/connector-manifest.js";
import type { SwarmManifest } from "../../schema/swarm-manifest.js";
import type { WorkflowManifest } from "../../schema/workflow-manifest.js";
import {
  COMPANY_MANIFEST_SCHEMA_VERSION,
  type CompanyManifest,
  type CompanyManifestCredentials,
  type CompanyManifestSignatures,
  type MonteCarloWinner,
  type PhaseTimings,
  type DryRunState,
} from "../../schema/company-manifest.js";
import { writeArtifact } from "../../state/session.js";
import { invokeMonteCarlo } from "./mc-invocation.js";
import { generateImprintReview } from "./imprint-review.js";

export interface AssembleCompanyManifestInput {
  companyId: string;
  orgId: string;
  responses: PillarResponses;
  connectorManifest: ConnectorManifest;
  swarmManifest: SwarmManifest;
  workflowManifest: WorkflowManifest;
  /** Optional timings recorded during earlier phases (if tracked). */
  phaseTimings?: Partial<PhaseTimings>;
  /** Skip both MC invocation noise and the T2 imprint call (for tests). */
  skipInference?: boolean;
  /** MC run params overrides. */
  mc?: { horizon_cycles?: number; n_runs?: number; seed?: number };
  /** Who's signing this off. */
  operatorHandle?: string;
  /**
   * Credential summary from the Credential Concierge. Server-side caller fetches
   * this from the vault before calling assemble; the plugin stays DB-free.
   * Plaintext NEVER appears here — only metadata.
   */
  credentials?: CompanyManifestCredentials;
  now?: Date;
}

export interface AssembleResult {
  manifest: CompanyManifest;
  yamlPath: string;
  jsonPath: string;
  mcReportPath: string;
  source: "t2" | "fallback";
  warnings: string[];
}

function computeManifestHash(manifestWithoutSignatures: Omit<CompanyManifest, "signatures">): string {
  const canon = JSON.stringify(manifestWithoutSignatures);
  return `sha256:${createHash("sha256").update(canon).digest("hex")}`;
}

export async function assembleCompanyManifest(
  input: AssembleCompanyManifestInput,
): Promise<AssembleResult> {
  const warnings: string[] = [];
  const startedAt = Date.now();
  const now = input.now ?? new Date();

  // Run MC deterministically (not subject to skipInference; it's pure TS).
  const mc = invokeMonteCarlo(input.responses, {
    // @tunable finalize.mc_horizon_cycles
    horizon_cycles: input.mc?.horizon_cycles ?? 30,
    // @tunable finalize.mc_n_runs
    n_runs: input.mc?.n_runs ?? 30,
    // @tunable finalize.mc_seed
    seed: input.mc?.seed ?? 42,
  });

  // Imprint review — T2 call, optional skip
  const imprint = await generateImprintReview({
    companyId: input.companyId,
    responses: input.responses,
    connectors: input.connectorManifest,
    swarm: input.swarmManifest,
    workflows: input.workflowManifest,
    mcWinner: mc.winner,
    skipInference: input.skipInference,
  });
  warnings.push(...imprint.warnings);

  // Write MC report as a separate artifact (company.manifest.yaml stays readable).
  const mcReportPath = await writeArtifact(
    input.companyId,
    "monte_carlo_report.json",
    JSON.stringify(mc.report, null, 2),
  );

  const dryRun: DryRunState = {
    enabled: true,
    expires_at: input.connectorManifest.dry_run_expires_at,
    post_expiration_action: "require_board_approval_to_go_live",
  };

  const phaseTimings: PhaseTimings = {
    ...input.phaseTimings,
    finalize_ms: Date.now() - startedAt,
  };

  const manifestWithoutSignatures: Omit<CompanyManifest, "signatures"> = {
    schema_version: COMPANY_MANIFEST_SCHEMA_VERSION,
    org_id: input.orgId,
    finalized_at: now.toISOString(),
    phase_timings: phaseTimings,
    pillar_responses: input.responses,
    connector_manifest: input.connectorManifest,
    swarm_manifest: input.swarmManifest,
    workflow_manifest: input.workflowManifest,
    mc_winner: mc.winner,
    mc_report_ref: "./monte_carlo_report.json",
    imprint_summary: imprint.summary,
    dry_run: dryRun,
    ...(input.credentials ? { credentials: input.credentials } : {}),
  };

  const signatures: CompanyManifestSignatures = {
    generated_by_operator: input.operatorHandle ?? "board",
    generated_by_system: `OPERATOR_Ω/plugin-onboarding@0.1.0 · run=${randomUUID()}`,
    manifest_hash: computeManifestHash(manifestWithoutSignatures),
  };

  const finalManifest: CompanyManifest = { ...manifestWithoutSignatures, signatures };

  const yamlPath = await writeArtifact(
    input.companyId,
    "company.manifest.yaml",
    yaml.dump(finalManifest, { indent: 2, lineWidth: 120, noRefs: true }),
  );
  const jsonPath = await writeArtifact(
    input.companyId,
    "company.manifest.json",
    JSON.stringify(finalManifest, null, 2),
  );

  return {
    manifest: finalManifest,
    yamlPath,
    jsonPath,
    mcReportPath,
    source: imprint.source,
    warnings,
  };
}

export { computeManifestHash };

export type { MonteCarloWinner } from "../../schema/company-manifest.js";
