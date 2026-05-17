import { describe, expect, it } from "vitest";
import { runSwarmDecisionMatrix, hashConnectorManifest } from "./decision-matrix.js";
import { BASE_ROSTER, BASE_ROSTER_SIZE } from "./base-roster.js";
import type { PillarResponses } from "../../schema/pillar-responses.js";
import type { ConnectorManifest } from "../../schema/connector-manifest.js";

function baseResponses(overrides: Partial<PillarResponses> = {}): PillarResponses {
  return {
    schema_version: "1.0",
    started_at: "2026-04-20T00:00:00Z",
    completed_at: "2026-04-20T00:05:00Z",
    pillar_1: {
      org_name: "Acme",
      company_context: "B2B SaaS workflow automation.",
      has_product: true,
      industry_hint: "b2b_saas",
      business_model_hint: "subscription",
      raw_input: "https://acme.example",
      enriched_at: "2026-04-20T00:01:00Z",
    },
    pillar_2: {
      claude_code_verified: true,
      claude_plan: "max_20x",
      inference_budget_profile: "premium",
      verified_at: "2026-04-20T00:02:00Z",
    },
    pillar_3: {
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
    },
    pillar_4: {
      lead_sources: ["outbound_cold"],
      lead_source: "outbound_cold",
      sales_motion: "high_touch_enterprise",
      close_channel: "mostly_phone_video",
      gtm_profile_enum: "OUTBOUND_HIGH_TOUCH_SAAS",
    },
    pillar_5: { comm_channel: "slack" },
    ...overrides,
  };
}

function baseConnectors(overrides: Partial<ConnectorManifest> = {}): ConnectorManifest {
  return {
    schema_version: "1.0",
    generated_at: "2026-04-20T00:06:00Z",
    generated_by: "T0 · decision-matrix-fallback",
    based_on: { pillar_responses_hash: "sha256:test" },
    required: [
      { id: "claude-code", priority: "P-1", rationale: "…", status: "configured" },
      { id: "supabase", priority: "P0", rationale: "…", status: "pending_credential", dry_run: true },
      { id: "github", priority: "P0", rationale: "…", status: "pending_credential" },
      { id: "slack", priority: "P0", rationale: "…", status: "pending_credential", dry_run: false },
    ],
    suggested: [{ id: "mixpanel", priority: "P1", rationale: "…", status: "pending_decision" }],
    deferred: [],
    blocked_on_manual_approval: [],
    dry_run_expires_at: "2026-05-04T00:06:00Z",
    ...overrides,
  };
}

describe("Phase 3 swarm decision matrix", () => {
  it("topology sums to the base roster size", () => {
    const m = runSwarmDecisionMatrix(baseResponses(), baseConnectors());
    const { active_count, parked_count, disabled_count, total_base_roster } = m.topology;
    expect(total_base_roster).toBe(BASE_ROSTER_SIZE);
    expect(active_count + parked_count + disabled_count).toBe(BASE_ROSTER_SIZE);
  });

  it("keeps ceo.orchestrator + all 6 chiefs active", () => {
    const m = runSwarmDecisionMatrix(baseResponses(), baseConnectors());
    for (const id of ["ceo.orchestrator", "cpo", "cmo", "cro", "cfo", "cdo", "coo"]) {
      expect(m.agents[id].status).toBe("active");
    }
  });

  it("disables cpo.qa + parks cpo.build when has_product=false", () => {
    const r = baseResponses();
    r.pillar_1!.has_product = false;
    r.pillar_3!.product_state = "idea_only";
    const m = runSwarmDecisionMatrix(r, baseConnectors());
    expect(m.agents["cpo.qa"].status).toBe("disabled");
    expect(m.agents["cpo.build"].status).toBe("parked");
    expect(m.agents["cpo.build"].unpark_condition).toContain("has_product");
  });

  it("parks cro.expansion + disables cfo.econ when pre-revenue", () => {
    const r = baseResponses();
    r.pillar_1!.has_product = true;
    r.pillar_3!.product_state = "built_not_selling";
    const m = runSwarmDecisionMatrix(r, baseConnectors());
    expect(m.agents["cro.expansion"].status).toBe("parked");
    expect(m.agents["cfo.econ"].status).toBe("disabled");
  });

  it("marks cro.outbound S+ under outbound GTM", () => {
    const m = runSwarmDecisionMatrix(baseResponses(), baseConnectors());
    expect(m.agents["cro.outbound"].spawnable).toBe(true);
    expect(m.spawn_eligibility.some((s) => s.agent === "cro.outbound")).toBe(true);
  });

  it("puts cfo.treasury + cfo.forecast on standby when Supabase missing", () => {
    const c = baseConnectors();
    c.required = c.required.filter((e) => e.id !== "supabase");
    const m = runSwarmDecisionMatrix(baseResponses(), c);
    // Sprint 002 · standby semantics: agent is needed but waiting on a connector.
    expect(m.agents["cfo.treasury"].status).toBe("standby");
    expect(m.agents["cfo.treasury"].waiting_on_connector).toBe("supabase");
    expect(m.agents["cfo.forecast"].status).toBe("standby");
    expect(m.agents["cfo.forecast"].waiting_on_connector).toBe("supabase");
  });

  it("bundle_allocation_initial sums to ~1.0", () => {
    const m = runSwarmDecisionMatrix(baseResponses(), baseConnectors());
    const a = m.bundle_allocation_initial;
    const total = a.insight_activation + a.pipeline_velocity + a.expansion_engine + a.unit_economics + a.strategic_positioning;
    expect(total).toBeGreaterThan(0.98);
    expect(total).toBeLessThan(1.02);
  });

  it("weights pipeline_velocity up under outbound GTM", () => {
    const m = runSwarmDecisionMatrix(baseResponses(), baseConnectors());
    expect(m.bundle_allocation_initial.pipeline_velocity).toBeGreaterThan(0.2);
  });

  it("weights insight_activation up under INBOUND_PLG GTM", () => {
    const r = baseResponses();
    r.pillar_4!.gtm_profile_enum = "INBOUND_PLG";
    const m = runSwarmDecisionMatrix(r, baseConnectors());
    // INBOUND_PLG delta: IA +0.10 (on top of 10k_100k_mrr base IA=0.15 → 0.25 pre-normalize)
    expect(m.bundle_allocation_initial.insight_activation).toBeGreaterThan(0.2);
  });

  it("weights strategic_positioning up under CONTENT_LED_PLG GTM", () => {
    const r = baseResponses();
    r.pillar_4!.gtm_profile_enum = "CONTENT_LED_PLG";
    const m = runSwarmDecisionMatrix(r, baseConnectors());
    // CONTENT_LED_PLG delta: IA +0.05, SP +0.05 → SP should lift above the balanced default
    expect(m.bundle_allocation_initial.strategic_positioning).toBeGreaterThan(0.2);
  });

  it("produces distinct allocations across stages (differential signal)", () => {
    const pre = runSwarmDecisionMatrix(
      baseResponses({ pillar_3: { ...baseResponses().pillar_3!, stage: "pre_product", product_state: "idea_only" } }),
      baseConnectors(),
    ).bundle_allocation_initial;
    const late = runSwarmDecisionMatrix(
      baseResponses({ pillar_3: { ...baseResponses().pillar_3!, stage: "more_than_1m_mrr" } }),
      baseConnectors(),
    ).bundle_allocation_initial;
    // pre_product should tilt toward insight_activation; more_than_1m toward expansion_engine
    expect(pre.insight_activation).toBeGreaterThan(late.insight_activation);
    expect(late.expansion_engine).toBeGreaterThan(pre.expansion_engine);
  });

  it("parks outbound agents under BOOTSTRAP_NO_GTM", () => {
    const r = baseResponses();
    r.pillar_4!.gtm_profile_enum = "BOOTSTRAP_NO_GTM";
    const m = runSwarmDecisionMatrix(r, baseConnectors());
    expect(m.agents["cro.outbound"].status).toBe("parked");
    expect(m.agents["cmo.demand"].status).toBe("parked");
  });

  it("produces a stable connector_manifest_hash", () => {
    const c = baseConnectors();
    expect(hashConnectorManifest(c)).toBe(hashConnectorManifest(c));
    expect(hashConnectorManifest(c)).toMatch(/^sha256:/);
  });

  it("base roster has exactly 34 entries (33 base + coo.credentials from Concierge integration)", () => {
    expect(BASE_ROSTER.length).toBe(34);
  });
});
