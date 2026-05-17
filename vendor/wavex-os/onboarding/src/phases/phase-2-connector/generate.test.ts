import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import yaml from "js-yaml";
import { generateConnectorManifest } from "./generate.js";
import { savePillarResponses } from "../../state/session.js";
import { emptyPillarResponses } from "../../schema/pillar-responses.js";

const COMPANY = "companytest-11111111-1111-1111-1111-111111111111";

function fillResponses() {
  const base = emptyPillarResponses();
  base.pillar_1 = {
    org_name: "Acme",
    company_context: "…",
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

describe("generateConnectorManifest · fallback path", () => {
  let root: string;
  let envBackup: string | undefined;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "omega-phase2-"));
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

  it("writes both YAML and JSON artifacts", async () => {
    const responses = fillResponses();
    await savePillarResponses(COMPANY, responses);

    const result = await generateConnectorManifest({
      companyId: COMPANY,
      responses,
      skipInference: true,
    });

    expect(result.source).toBe("fallback");
    expect(result.manifest.schema_version).toBe("1.0");
    expect(result.manifest.required.length).toBeGreaterThan(0);

    const yamlContent = await readFile(result.yamlPath, "utf8");
    const reparsed = yaml.load(yamlContent) as typeof result.manifest;
    expect(reparsed.required.some((r) => r.id === "claude-code")).toBe(true);
    expect(reparsed.required.some((r) => r.id === "supabase")).toBe(true);
    expect(reparsed.required.some((r) => r.id === "slack")).toBe(true);

    const jsonContent = await readFile(result.jsonPath, "utf8");
    const jsonManifest = JSON.parse(jsonContent);
    expect(jsonManifest.generated_by).toMatch(/decision-matrix/);
  });

  it("stamps a stable pillar_responses_hash in based_on", async () => {
    const r1 = await generateConnectorManifest({
      companyId: COMPANY,
      responses: fillResponses(),
      skipInference: true,
    });
    const r2 = await generateConnectorManifest({
      companyId: COMPANY,
      responses: fillResponses(),
      skipInference: true,
    });
    expect(r1.manifest.based_on.pillar_responses_hash).toBe(r2.manifest.based_on.pillar_responses_hash);
    expect(r1.manifest.based_on.pillar_responses_hash).toMatch(/^sha256:/);
  });
});
