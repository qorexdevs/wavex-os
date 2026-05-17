/**
 * OPΩ-ONB-TEST-001-rev2 · Appendix §6 · Step 2
 *
 * Drives the full 5-phase onboarding pipeline against a fixture, returns all
 * intermediate + final artifacts. Uses a unique temp directory per run so
 * parallel tests don't collide (PAPERCLIP_DATA_DIR env override).
 */

import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import {
  handlePillar1,
  handlePillar2,
  handlePillar3,
  handlePillar4,
  handlePillar5,
  updatePillar,
  loadPillarResponses,
  generateConnectorManifest,
  generateSwarmManifest,
  generateWorkflowManifest,
  assembleCompanyManifest,
  sessionPaths,
  type PillarResponses,
  type ConnectorManifest,
  type SwarmManifest,
  type WorkflowManifest,
  type CompanyManifest,
} from "../../../src/index.js";
import type { Pillar3Input } from "../../../src/phases/phase-1-onboard/pillar-3.js";
import type { Pillar4Input } from "../../../src/phases/phase-1-onboard/pillar-4.js";
import type { Pillar5Input } from "../../../src/phases/phase-1-onboard/pillar-5.js";
import { buildPillar1Input, buildPillar2Input } from "./mock-inference-clients.js";

export interface OnboardingFixture {
  fixture_id: string;
  description: string;
  pillar_1: {
    org_name: string;
    input: string;
    mocked_enrichment: {
      company_context: string;
      has_product: boolean;
      industry_hint: string;
      business_model_hint: string;
    };
  };
  pillar_2: {
    claude_plan: "max_20x" | "max_5x" | "api_only" | "other";
    claude_plan_other_note?: string;
    mocked_shell_result: { exit_code: number; stdout?: string; stderr?: string };
  };
  pillar_3: Pillar3Input;
  pillar_4: Pillar4Input;
  pillar_5: Pillar5Input;
}

export interface PipelineRunOptions {
  /** When true, Phases 2/3/4 + imprint skip live T2. Used by Suite 4's Run B. */
  skipInference?: boolean;
  /** Fixed MC seed for determinism checks (Suite 2). */
  mcSeed?: number;
  /** If set, keep the temp data dir for inspection. Otherwise cleaned up on return. */
  keepDataDir?: boolean;
  /** Override operator handle recorded in manifest signatures. */
  operatorHandle?: string;
}

export interface PipelineRunResult {
  fixture_id: string;
  run_id: string;
  companyId: string;
  dataDir: string;
  pillarResponses: PillarResponses;
  connectorManifest: ConnectorManifest;
  swarmManifest: SwarmManifest;
  workflowManifest: WorkflowManifest;
  companyManifest: CompanyManifest;
  /** Count of *live* T2 calls made (mocked calls don't count). */
  t2CallCount: number;
  /** Phase outcome: either success or Pillar 2 halted the pipeline. */
  halted:
    | { kind: "success" }
    | { kind: "pillar_2_failed"; fixHint?: string };
  /** Per-phase wall-clock in ms. */
  timings: { pillar_1_ms: number; pillar_2_ms: number; pillar_3_5_ms: number; phase_2_ms: number; phase_3_ms: number; phase_4_ms: number; finalize_ms: number };
}

/** Minimum deterministic UUID for fixture-backed companies. */
const FIXTURE_COMPANY_UUID = "00000000-0000-0000-0000-000000000001";

/**
 * Runs the full pipeline against a fixture. Throws if Phase 2 halts with
 * `halted.kind === "pillar_2_failed"` — caller handles by treating pipeline
 * as the expected halted state for the `claude-code-fails` edge case.
 */
export async function runOnboardingPipeline(
  fixture: OnboardingFixture,
  options: PipelineRunOptions = {},
): Promise<PipelineRunResult> {
  const runId = randomUUID();
  const companyId = FIXTURE_COMPANY_UUID;
  const dataDir = await mkdtemp(join(tmpdir(), `opω-onb-${fixture.fixture_id}-`));
  const prevDataDir = process.env.PAPERCLIP_DATA_DIR;
  process.env.PAPERCLIP_DATA_DIR = dataDir;

  let t2CallCount = 0;

  const t0 = Date.now();
  try {
    // ------------------------------------------------------------------
    // Phase 1
    // ------------------------------------------------------------------
    const p1 = await handlePillar1(buildPillar1Input(fixture.pillar_1));
    await updatePillar(companyId, "pillar_1", p1);
    const pillar_1_ms = Date.now() - t0;

    const t1 = Date.now();
    const p2 = await handlePillar2(buildPillar2Input(fixture.pillar_2));
    await updatePillar(companyId, "pillar_2", p2.response);
    const pillar_2_ms = Date.now() - t1;

    if (!p2.ok) {
      // Expected halt — skip downstream and return early.
      const pillarResponses = await loadPillarResponses(companyId);
      return {
        fixture_id: fixture.fixture_id,
        run_id: runId,
        companyId,
        dataDir,
        pillarResponses,
        connectorManifest: {} as never,
        swarmManifest: {} as never,
        workflowManifest: {} as never,
        companyManifest: {} as never,
        t2CallCount: 0,
        halted: { kind: "pillar_2_failed", fixHint: p2.fix_hint },
        timings: { pillar_1_ms, pillar_2_ms, pillar_3_5_ms: 0, phase_2_ms: 0, phase_3_ms: 0, phase_4_ms: 0, finalize_ms: 0 },
      };
    }

    const t2 = Date.now();
    const p3 = await handlePillar3(fixture.pillar_3);
    await updatePillar(companyId, "pillar_3", p3);
    // Back-compat shim: fixtures authored pre-Sprint-002 use `lead_source: "foo"`
    // (singular string). Sprint 002 moved to `lead_sources: ["foo", ...]` array.
    // Normalize without editing 28+ fixture JSON files.
    const fx4 = fixture.pillar_4 as unknown as {
      lead_source?: string;
      lead_sources?: string[];
      [k: string]: unknown;
    };
    const leadSources = fx4.lead_sources ?? (fx4.lead_source ? [fx4.lead_source] : []);
    // The cast through `Record<string, unknown>` lets the spread succeed under
    // strict tsc; the original `as never` blocked spread because `never` isn't
    // a spreadable type in TS 5.x's stricter mode.
    const p4 = await handlePillar4({
      ...(fx4 as Record<string, unknown>),
      lead_sources: leadSources,
    } as never);
    await updatePillar(companyId, "pillar_4", p4);
    const p5 = await handlePillar5(fixture.pillar_5);
    await updatePillar(companyId, "pillar_5", p5);
    const pillar_3_5_ms = Date.now() - t2;

    const pillarResponses = await loadPillarResponses(companyId);

    // ------------------------------------------------------------------
    // Phase 2 · Connector
    // ------------------------------------------------------------------
    const t3 = Date.now();
    const phase2 = await generateConnectorManifest({
      companyId,
      responses: pillarResponses,
      skipInference: options.skipInference,
    });
    if (phase2.source === "t2") t2CallCount += 1;
    const phase_2_ms = Date.now() - t3;

    // ------------------------------------------------------------------
    // Phase 3 · Swarm
    // ------------------------------------------------------------------
    const t4 = Date.now();
    const phase3 = await generateSwarmManifest({
      companyId,
      responses: pillarResponses,
      connectorManifest: phase2.manifest,
      skipInference: options.skipInference,
    });
    if (phase3.source === "t2") t2CallCount += 1;
    const phase_3_ms = Date.now() - t4;

    // ------------------------------------------------------------------
    // Phase 4 · Workflow
    // ------------------------------------------------------------------
    const t5 = Date.now();
    const phase4 = await generateWorkflowManifest({
      companyId,
      responses: pillarResponses,
      connectorManifest: phase2.manifest,
      swarmManifest: phase3.manifest,
      skipInference: options.skipInference,
      // Test harness has no paperclip budget server. The budget invariant
      // (Suite 5) belongs in a dedicated paperclip-integration test, not in
      // the differential-equation suites which are about surface quality.
      bypassBudgetCheck: true,
    });
    if (phase4.source === "t2") t2CallCount += 1;
    const phase_4_ms = Date.now() - t5;

    // ------------------------------------------------------------------
    // Finalize · MC + imprint + assemble
    // ------------------------------------------------------------------
    const t6 = Date.now();
    const finalize = await assembleCompanyManifest({
      companyId,
      orgId: fixture.fixture_id,
      responses: pillarResponses,
      connectorManifest: phase2.manifest,
      swarmManifest: phase3.manifest,
      workflowManifest: phase4.manifest,
      skipInference: options.skipInference,
      mc: options.mcSeed !== undefined ? { seed: options.mcSeed } : undefined,
      operatorHandle: options.operatorHandle ?? "diff-eq-suite",
    });
    if (finalize.source === "t2") t2CallCount += 1;
    const finalize_ms = Date.now() - t6;

    return {
      fixture_id: fixture.fixture_id,
      run_id: runId,
      companyId,
      dataDir,
      pillarResponses,
      connectorManifest: phase2.manifest,
      swarmManifest: phase3.manifest,
      workflowManifest: phase4.manifest,
      companyManifest: finalize.manifest,
      t2CallCount,
      halted: { kind: "success" },
      timings: { pillar_1_ms, pillar_2_ms, pillar_3_5_ms, phase_2_ms, phase_3_ms, phase_4_ms, finalize_ms },
    };
  } finally {
    if (prevDataDir === undefined) {
      delete process.env.PAPERCLIP_DATA_DIR;
    } else {
      process.env.PAPERCLIP_DATA_DIR = prevDataDir;
    }
    if (!options.keepDataDir) {
      await rm(dataDir, { recursive: true, force: true });
    }
  }
}

/** Load a fixture JSON from disk. */
export async function loadFixture(path: string): Promise<OnboardingFixture> {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as OnboardingFixture;
}

/** For Suite 2: get the on-disk artifact paths without cleanup. */
export function fixtureArtifactPaths(companyId: string, dataDir: string): {
  onboardingDir: string;
  pillar_responses_json: string;
  company_manifest_json: string;
} {
  const paths = sessionPaths(companyId, dataDir);
  return {
    onboardingDir: paths.onboardingDir,
    pillar_responses_json: paths.pillarResponsesFile,
    company_manifest_json: join(paths.onboardingDir, "company.manifest.json"),
  };
}
