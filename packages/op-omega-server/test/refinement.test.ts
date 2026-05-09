/** Refinement tests — surgical change-application + parse validation. */
import { describe, expect, it } from "vitest";
import type { CompanyManifest, ConnectorManifest, SwarmManifest, WorkflowManifest, PillarResponses, MonteCarloWinner } from "@op-omega/plugin-onboarding";
import { applyChanges } from "../src/refinement/apply.js";
import { parseAnalyzeResponse } from "../src/refinement/parse.js";
import type {
  Change, ConnectorAddChange, ConnectorPromoteChange,
  SwarmOverlayChange, WorkflowTaskAddChange,
} from "../src/refinement/types.js";

function fixtureManifest(): CompanyManifest {
  const connectorManifest: ConnectorManifest = {
    schema_version: "1.0",
    generated_at: "2026-05-09T00:00:00Z",
    generated_by: "T0",
    based_on: { pillar_responses_hash: "x" },
    required: [
      { id: "claude-code", priority: "P-1", rationale: "inference", status: "configured" },
      { id: "supabase", priority: "P0", rationale: "data substrate", status: "pending_credential" },
    ],
    suggested: [
      { id: "mixpanel", priority: "P1", rationale: "product analytics", status: "pending_decision" },
    ],
    deferred: [
      { id: "shipstation", priority: "P2", rationale: "fulfillment later", status: "pending_decision" },
    ],
    blocked_on_manual_approval: [],
    dry_run_expires_at: "2026-05-23T00:00:00Z",
  };
  const swarmManifest: SwarmManifest = {
    schema_version: "1.0",
    generated_at: "2026-05-09T00:00:00Z",
    generated_by: "T0",
    based_on: { pillar_responses_hash: "x", connector_manifest_hash: "y" },
    topology: {
      total_base_roster: 3, active_count: 2, standby_count: 0, parked_count: 1, disabled_count: 0,
    },
    agents: {
      "ceo.orchestrator": {
        status: "active", adapter: "claude-code", heartbeat: "15m", budget_monthly_usd: 300,
        skill_overlay: null, department: "ceo", level: "L·II", reports_to: null, spawnable: false,
      },
      "cfo": {
        status: "active", adapter: "claude-code", heartbeat: "1h", budget_monthly_usd: 120,
        skill_overlay: "Generic CFO overlay", department: "finance", level: "L·III",
        reports_to: "ceo.orchestrator", spawnable: true,
      },
      "cro.outbound": {
        status: "parked", adapter: "claude-code", heartbeat: "30m", budget_monthly_usd: 120,
        skill_overlay: null, department: "revenue", level: "L·III",
        reports_to: "ceo.orchestrator", spawnable: false,
        unpark_condition: "operator adopts outbound motion",
      },
    },
    spawn_eligibility: [],
    bundle_allocation_initial: {
      insight_activation: 0.2, pipeline_velocity: 0.2, expansion_engine: 0.2,
      unit_economics: 0.2, strategic_positioning: 0.2,
    },
  };
  const workflowManifest: WorkflowManifest = {
    schema_version: "1.0",
    generated_at: "2026-05-09T00:00:00Z",
    generated_by: "T0",
    based_on: { pillar_responses_hash: "x", connector_manifest_hash: "y", swarm_manifest_hash: "z" },
    agent_workflows: {
      "ceo.orchestrator": { heartbeat: "15m", on_fire: [{ task: "review fleet" }], escalation: [] },
      "cfo": { heartbeat: "1h", on_fire: [{ task: "compute MRR" }], escalation: [] },
    },
    bundle_workflows: {
      insight_activation: { owner: "ceo.orchestrator", cycle_length: "30d", participating_agents: ["cfo"], kpis_moved: [] },
      pipeline_velocity:  { owner: "ceo.orchestrator", cycle_length: "30d", participating_agents: ["cfo"], kpis_moved: [] },
      expansion_engine:   { owner: "ceo.orchestrator", cycle_length: "30d", participating_agents: ["cfo"], kpis_moved: [] },
      unit_economics:     { owner: "ceo.orchestrator", cycle_length: "30d", participating_agents: ["cfo"], kpis_moved: [] },
      strategic_positioning: { owner: "ceo.orchestrator", cycle_length: "30d", participating_agents: ["cfo"], kpis_moved: [] },
    },
    scheduled_routines_enabled: {},
    dry_run_gates: [],
  };
  const mcWinner: MonteCarloWinner = {
    strategy_id: "RETENTION_FIRST", sharpe: 1.5, mean_mrr_growth: 0.5,
    mean_burn_multiple: 0.9, p_auto_catalytic: 0.95, p_ruin: 0.0,
    mean_cycles_to_critical: 3, rationale: "test",
    run_params: { horizon_cycles: 10, n_runs: 10, seed: 42 },
  };
  const pillarResponses: PillarResponses = {
    schema_version: "1.0", started_at: "2026-05-09T00:00:00Z", completed_at: "2026-05-09T00:01:00Z",
    pillar_1: {
      org_name: "Test Co", company_context: "test context", has_product: true,
      industry_hint: "consumer_hardware", business_model_hint: "one_time",
      raw_input: "https://test.example", enriched_at: "2026-05-09T00:00:30Z",
    },
    pillar_2: null, pillar_3: null, pillar_4: null, pillar_5: null,
  };
  return {
    schema_version: "1.0",
    org_id: "test-co",
    finalized_at: "2026-05-09T00:01:00Z",
    phase_timings: { finalize_ms: 100 },
    pillar_responses: pillarResponses,
    connector_manifest: connectorManifest,
    swarm_manifest: swarmManifest,
    workflow_manifest: workflowManifest,
    mc_winner: mcWinner,
    mc_report_ref: "mc-report.json",
    imprint_summary: "test imprint",
    dry_run: { enabled: true, expires_at: "2026-05-23T00:00:00Z", post_expiration_action: "require_board_approval_to_go_live" },
    signatures: { generated_by_operator: "test", generated_by_system: "wavex-os@0.1.0", manifest_hash: "sha256:0".repeat(64).slice(0, 70) },
  };
}

describe("refinement applyChanges", () => {
  it("connector_add inserts into the target bucket", () => {
    const m = fixtureManifest();
    const ch: ConnectorAddChange = {
      id: "add-stripe-required", action: "connector_add", rationale: "billing rail",
      connector_id: "stripe", bucket: "required", priority: "P0",
    };
    const { applied } = applyChanges(m, [ch]);
    expect(applied).toHaveLength(1);
    expect(m.connector_manifest.required.find((e) => e.id === "stripe")).toBeDefined();
  });

  it("connector_add no-ops if connector already in bucket", () => {
    const m = fixtureManifest();
    const ch: ConnectorAddChange = {
      id: "add-supabase-required", action: "connector_add", rationale: "dup",
      connector_id: "supabase", bucket: "required", priority: "P0",
    };
    const before = m.connector_manifest.required.length;
    applyChanges(m, [ch]);
    expect(m.connector_manifest.required.length).toBe(before);
  });

  it("connector_promote moves entry between buckets", () => {
    const m = fixtureManifest();
    const ch: ConnectorPromoteChange = {
      id: "promote-mixpanel", action: "connector_promote", rationale: "load-bearing now",
      connector_id: "mixpanel", from_bucket: "suggested", to_bucket: "required",
    };
    const { applied } = applyChanges(m, [ch]);
    expect(applied).toHaveLength(1);
    expect(m.connector_manifest.suggested.find((e) => e.id === "mixpanel")).toBeUndefined();
    expect(m.connector_manifest.required.find((e) => e.id === "mixpanel")).toBeDefined();
  });

  it("connector_promote skips with warning if entry no longer in from_bucket", () => {
    const m = fixtureManifest();
    const ch: ConnectorPromoteChange = {
      id: "promote-ghost", action: "connector_promote", rationale: "stale",
      connector_id: "ghost-connector", from_bucket: "suggested", to_bucket: "required",
    };
    const { applied, warnings } = applyChanges(m, [ch]);
    expect(applied).toHaveLength(0);
    expect(warnings.some((w) => w.includes("ghost-connector"))).toBe(true);
  });

  it("swarm_overlay rewrites the agent's skill_overlay", () => {
    const m = fixtureManifest();
    const ch: SwarmOverlayChange = {
      id: "overlay-cfo", action: "swarm_overlay", rationale: "tailor to international",
      slot: "cfo", new_overlay: "Tailored CFO overlay for international hardware ops",
    };
    const { applied } = applyChanges(m, [ch]);
    expect(applied).toHaveLength(1);
    expect(m.swarm_manifest.agents.cfo.skill_overlay).toBe("Tailored CFO overlay for international hardware ops");
  });

  it("workflow_task_add appends to on_fire + records dry_run_gate when set", () => {
    const m = fixtureManifest();
    const ch: WorkflowTaskAddChange = {
      id: "task-cfo-attribution", action: "workflow_task_add", rationale: "dealer attribution",
      slot: "cfo",
      task: { task: "compute dealer-channel attribution", tier: "T1", flow_type: "TLM", dry_run_gate: true },
    };
    const { applied } = applyChanges(m, [ch]);
    expect(applied).toHaveLength(1);
    expect(m.workflow_manifest.agent_workflows.cfo.on_fire).toHaveLength(2);
    expect(m.workflow_manifest.dry_run_gates.length).toBeGreaterThan(0);
  });

  it("multiple changes apply in order; failed ones report warnings without blocking", () => {
    const m = fixtureManifest();
    const changes: Change[] = [
      { id: "c1", action: "connector_add", rationale: "ok", connector_id: "stripe", bucket: "required", priority: "P0" },
      { id: "c2", action: "swarm_overlay", rationale: "missing slot", slot: "ghost-slot", new_overlay: "x" },
      { id: "c3", action: "swarm_overlay", rationale: "ok", slot: "cfo", new_overlay: "tailored" },
    ];
    const { applied, warnings } = applyChanges(m, changes);
    expect(applied.map((c) => c.id)).toEqual(["c1", "c3"]);
    expect(warnings.some((w) => w.includes("ghost-slot"))).toBe(true);
    expect(m.swarm_manifest.agents.cfo.skill_overlay).toBe("tailored");
  });
});

describe("refinement parseAnalyzeResponse", () => {
  const opts = {
    activeSlots: new Set(["ceo.orchestrator", "cfo"]),
    baselineRequired: new Set(["claude-code", "supabase"]),
    baselineSuggested: new Set(["mixpanel"]),
    baselineDeferred: new Set(["shipstation"]),
  };

  it("imprint_only=true with no changes when guidance is prose", () => {
    const raw = JSON.stringify({ imprint_only: true, rationale_summary: "tone tweak only", changes: [] });
    const { result } = parseAnalyzeResponse(raw, opts);
    expect(result.imprint_only).toBe(true);
    expect(result.changes).toHaveLength(0);
  });

  it("rejects connector_add with unknown connector_id", () => {
    const raw = JSON.stringify({
      imprint_only: false, rationale_summary: "x",
      changes: [{ id: "c1", action: "connector_add", rationale: "x", connector_id: "fake-conn", bucket: "required", priority: "P0" }],
    });
    const { result, warnings } = parseAnalyzeResponse(raw, opts);
    expect(result.changes).toHaveLength(0);
    expect(warnings.some((w) => w.includes("fake-conn"))).toBe(true);
  });

  it("rejects connector_add with already-existing connector", () => {
    const raw = JSON.stringify({
      imprint_only: false, rationale_summary: "x",
      changes: [{ id: "c1", action: "connector_add", rationale: "x", connector_id: "supabase", bucket: "suggested", priority: "P1" }],
    });
    const { result, warnings } = parseAnalyzeResponse(raw, opts);
    expect(result.changes).toHaveLength(0);
    expect(warnings.some((w) => w.includes("already exists"))).toBe(true);
  });

  it("accepts well-formed connector_add", () => {
    const raw = JSON.stringify({
      imprint_only: false, rationale_summary: "x",
      changes: [{ id: "c1", action: "connector_add", rationale: "billing rail", connector_id: "stripe", bucket: "required", priority: "P0" }],
    });
    const { result } = parseAnalyzeResponse(raw, opts);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].action).toBe("connector_add");
  });

  it("rejects swarm_overlay against unknown slot", () => {
    const raw = JSON.stringify({
      imprint_only: false, rationale_summary: "x",
      changes: [{ id: "c1", action: "swarm_overlay", rationale: "x", slot: "ghost", new_overlay: "y" }],
    });
    const { result, warnings } = parseAnalyzeResponse(raw, opts);
    expect(result.changes).toHaveLength(0);
    expect(warnings.some((w) => w.includes("ghost"))).toBe(true);
  });

  it("caps changes at 8 per refinement", () => {
    const changes = Array.from({ length: 12 }, (_, i) => ({
      id: `c${i}`, action: "swarm_overlay", rationale: "x", slot: "cfo", new_overlay: `overlay ${i}`,
    }));
    const raw = JSON.stringify({ imprint_only: false, rationale_summary: "x", changes });
    const { result, warnings } = parseAnalyzeResponse(raw, opts);
    expect(result.changes).toHaveLength(8);
    expect(warnings.some((w) => w.includes("Trimmed"))).toBe(true);
  });

  it("graceful fallback when raw is not valid JSON", () => {
    const { result, warnings } = parseAnalyzeResponse("not json at all", opts);
    expect(result.imprint_only).toBe(true);
    expect(result.changes).toHaveLength(0);
    expect(warnings.some((w) => w.includes("no JSON"))).toBe(true);
  });
});
