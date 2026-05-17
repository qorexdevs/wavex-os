import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import yaml from "js-yaml";
import { assembleCompanyManifest, computeManifestHash } from "./assemble.js";
import { runDecisionMatrix } from "../phase-2-connector/decision-matrix.js";
import { runSwarmDecisionMatrix } from "../phase-3-swarm/decision-matrix.js";
import { runWorkflowDecisionMatrix } from "../phase-4-workflow/decision-matrix.js";
import { emptyPillarResponses, type PillarResponses } from "../../schema/pillar-responses.js";

const COMPANY = "companytest-22222222-2222-2222-2222-222222222222";

function fullResponses(): PillarResponses {
  const base = emptyPillarResponses();
  base.pillar_1 = {
    org_name: "Acme Tools",
    company_context: "B2B SaaS workflow automation for ops teams.",
    has_product: true,
    industry_hint: "b2b_saas",
    business_model_hint: "subscription",
    raw_input: "https://acme.example",
    enriched_at: "2026-04-20T00:01:00Z",
  };
  base.pillar_2 = {
    claude_code_verified: true,
    claude_plan: "max_20x",
    inference_budget_profile: "premium",
    verified_at: "2026-04-20T00:02:00Z",
  };
  base.pillar_3 = {
    product_state: "live_paying_customers",
    stage: "10k_100k_mrr",
    kpi_snapshot_initial: {
      t: "2026-04-20T00:03:00Z",
      mrr: 45_000,
      nrr: 1.05,
      grr: 0.92,
      cac: 900,
      cac_payback_months: 12,
      burn_multiple: 1.3,
      activation_rate: 0.42,
      sales_cycle_days: 28,
      win_rate: 0.22,
      ltv_cac_ratio: 2.8,
      pipeline_velocity: 150_000,
      narrative_strength: 0.5,
      ai_estimated: true,
    },
  };
  base.pillar_4 = {
    lead_sources: ["outbound_cold"],
    lead_source: "outbound_cold",
    sales_motion: "high_touch_enterprise",
    close_channel: "mostly_phone_video",
    gtm_profile_enum: "OUTBOUND_HIGH_TOUCH_SAAS",
  };
  base.pillar_5 = { comm_channel: "slack" };
  base.completed_at = "2026-04-20T00:05:00Z";
  return base;
}

describe("assembleCompanyManifest · skipInference (fallback imprint)", () => {
  let root: string;
  let envBackup: string | undefined;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "omega-finalize-"));
    envBackup = process.env.PAPERCLIP_DATA_DIR;
    process.env.PAPERCLIP_DATA_DIR = root;
  });
  afterEach(async () => {
    if (envBackup === undefined) {
      delete process.env.PAPERCLIP_DATA_DIR;
    } else {
      process.env.PAPERCLIP_DATA_DIR = envBackup;
    }
    await rm(root, { recursive: true, force: true });
  });

  it("writes all three artifacts (company.yaml, company.json, mc_report.json)", async () => {
    const responses = fullResponses();
    const connectorManifest = runDecisionMatrix(responses);
    const swarmManifest = runSwarmDecisionMatrix(responses, connectorManifest);
    const workflowManifest = runWorkflowDecisionMatrix(swarmManifest, connectorManifest);

    const r = await assembleCompanyManifest({
      companyId: COMPANY,
      orgId: "acme-tools",
      responses,
      connectorManifest,
      swarmManifest,
      workflowManifest,
      skipInference: true,
    });

    expect(r.source).toBe("fallback");
    expect(r.manifest.schema_version).toBe("1.0");
    expect(r.manifest.org_id).toBe("acme-tools");
    expect(r.manifest.mc_winner.strategy_id).toBeDefined();
    expect(r.manifest.imprint_summary.length).toBeGreaterThan(200);
    expect(r.manifest.signatures.manifest_hash).toMatch(/^sha256:/);
    expect(r.manifest.dry_run.enabled).toBe(true);

    const yamlContent = await readFile(r.yamlPath, "utf8");
    const reparsed = yaml.load(yamlContent) as typeof r.manifest;
    expect(reparsed.pillar_responses.pillar_1?.org_name).toBe("Acme Tools");
    // 33 base + 1 (coo.credentials slot from Credential Concierge integration).
    expect(reparsed.swarm_manifest.topology.total_base_roster).toBe(34);

    const mcReportContent = await readFile(r.mcReportPath, "utf8");
    const mcReport = JSON.parse(mcReportContent);
    expect(mcReport.strategies).toHaveLength(5);
  });

  it("manifest_hash is stable across identical runs (minus timestamps)", async () => {
    const responses = fullResponses();
    const c = runDecisionMatrix(responses, { now: new Date("2026-04-20T00:00:00Z") });
    const s = runSwarmDecisionMatrix(responses, c, { now: new Date("2026-04-20T00:00:00Z") });
    const w = runWorkflowDecisionMatrix(s, c, { now: new Date("2026-04-20T00:00:00Z") });

    const now = new Date("2026-04-20T00:00:00Z");
    const r1 = await assembleCompanyManifest({
      companyId: COMPANY,
      orgId: "acme",
      responses,
      connectorManifest: c,
      swarmManifest: s,
      workflowManifest: w,
      skipInference: true,
      now,
    });
    const r2 = await assembleCompanyManifest({
      companyId: COMPANY,
      orgId: "acme",
      responses,
      connectorManifest: c,
      swarmManifest: s,
      workflowManifest: w,
      skipInference: true,
      now,
    });

    // Signatures.generated_by_system has a random run id, and phase_timings.finalize_ms
    // is wall-clock-derived — strip both for content-only hash comparison.
    const stripEphemeral = (m: unknown) => {
      const { signatures: _sig, phase_timings: _pt, ...rest } = m as { signatures: unknown; phase_timings: unknown };
      return rest;
    };
    expect(computeManifestHash(stripEphemeral(r1.manifest) as never)).toBe(
      computeManifestHash(stripEphemeral(r2.manifest) as never),
    );
  });

  it("embeds all four prior manifests verbatim", async () => {
    const responses = fullResponses();
    const c = runDecisionMatrix(responses);
    const s = runSwarmDecisionMatrix(responses, c);
    const w = runWorkflowDecisionMatrix(s, c);

    const r = await assembleCompanyManifest({
      companyId: COMPANY,
      orgId: "acme",
      responses,
      connectorManifest: c,
      swarmManifest: s,
      workflowManifest: w,
      skipInference: true,
    });

    expect(r.manifest.pillar_responses.schema_version).toBe("1.0");
    expect(r.manifest.connector_manifest.schema_version).toBe("1.0");
    expect(r.manifest.swarm_manifest.schema_version).toBe("1.0");
    expect(r.manifest.workflow_manifest.schema_version).toBe("1.0");
  });
});
