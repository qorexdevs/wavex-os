import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadPillarResponses,
  savePillarResponses,
  updatePillar,
  ensureOnboardingDir,
  writeArtifact,
} from "./session.js";
import { emptyPillarResponses } from "../schema/pillar-responses.js";

const COMPANY = "companytest-00000000-0000-0000-0000-000000000001";

describe("session state", () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "omega-onboarding-"));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("loadPillarResponses returns empty on first call", async () => {
    const r = await loadPillarResponses(COMPANY, root);
    expect(r.completed_at).toBeNull();
    expect(r.pillar_1).toBeNull();
  });

  it("save + load roundtrips", async () => {
    const base = emptyPillarResponses();
    const withPillar1 = {
      ...base,
      pillar_1: {
        org_name: "Acme",
        company_context: "…",
        has_product: true,
        industry_hint: "b2b_saas",
        business_model_hint: "subscription",
        raw_input: "https://acme.example",
        enriched_at: new Date().toISOString(),
      },
    };
    await savePillarResponses(COMPANY, withPillar1, root);
    const reloaded = await loadPillarResponses(COMPANY, root);
    expect(reloaded.pillar_1?.org_name).toBe("Acme");
  });

  it("updatePillar merges + marks completed_at when all 5 done", async () => {
    const now = new Date().toISOString();
    for (const key of ["pillar_1", "pillar_2", "pillar_3", "pillar_4", "pillar_5"] as const) {
      await updatePillar(COMPANY, key, makeStubFor(key) as never, root);
    }
    const final = await loadPillarResponses(COMPANY, root);
    expect(final.completed_at).not.toBeNull();
  });

  it("writeArtifact creates the onboarding dir and writes content", async () => {
    await ensureOnboardingDir(COMPANY, root);
    const p = await writeArtifact(COMPANY, "connector_manifest.yaml", "key: value\n", root);
    const content = await readFile(p, "utf8");
    expect(content).toContain("key: value");
  });

  it("updatePillar serializes concurrent writes for the same company (multi-tab race)", async () => {
    // Without the per-company mutex, two concurrent updatePillar calls would
    // both load the same baseline and the second save would clobber the
    // first's pillar — leaving only one of the two answers in the file.
    // With the mutex, the second call sees the first's result and merges.
    await Promise.all([
      updatePillar(COMPANY, "pillar_2", makeStubFor("pillar_2") as never, root),
      updatePillar(COMPANY, "pillar_3", makeStubFor("pillar_3") as never, root),
    ]);
    const final = await loadPillarResponses(COMPANY, root);
    expect(final.pillar_2).not.toBeNull();
    expect(final.pillar_3).not.toBeNull();
  });
});

function makeStubFor(key: string): unknown {
  switch (key) {
    case "pillar_1":
      return {
        org_name: "Acme",
        company_context: "stub",
        has_product: true,
        industry_hint: "b2b_saas",
        business_model_hint: "subscription",
        raw_input: "https://example.com",
        enriched_at: new Date().toISOString(),
      };
    case "pillar_2":
      return {
        claude_code_verified: true,
        claude_plan: "max_20x",
        claude_version: "stub",
        inference_budget_profile: "premium",
        verified_at: new Date().toISOString(),
      };
    case "pillar_3":
      return {
        product_state: "live_paying_customers",
        stage: "10k_100k_mrr",
        kpi_snapshot_initial: {
          t: new Date().toISOString(),
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
    case "pillar_4":
      return {
        lead_source: "outbound_cold",
        sales_motion: "high_touch_enterprise",
        close_channel: "mostly_phone_video",
        gtm_profile_enum: "OUTBOUND_HIGH_TOUCH_SAAS",
      };
    case "pillar_5":
      return { comm_channel: "slack" };
    default:
      throw new Error(`no stub for ${key}`);
  }
}
