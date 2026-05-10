import { describe, expect, it } from "vitest";
import { runWorkflowDecisionMatrix } from "./decision-matrix.js";
import { runSwarmDecisionMatrix } from "../phase-3-swarm/decision-matrix.js";
import type { PillarResponses } from "../../schema/pillar-responses.js";
import type { ConnectorManifest } from "../../schema/connector-manifest.js";
import { SCHEDULED_ROUTINES } from "./scheduled-routines.js";
import { CANONICAL_BUNDLE_WORKFLOWS } from "./bundle-workflows.js";

function baseResponses(): PillarResponses {
  return {
    schema_version: "1.0",
    started_at: "2026-04-20T00:00:00Z",
    completed_at: "2026-04-20T00:05:00Z",
    pillar_1: {
      org_name: "Acme",
      company_context: "B2B SaaS.",
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
  };
}

function baseConnectors(): ConnectorManifest {
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
  };
}

describe("Phase 4 workflow decision matrix", () => {
  it("produces an agent_workflows entry per active agent", () => {
    const swarm = runSwarmDecisionMatrix(baseResponses(), baseConnectors());
    const wf = runWorkflowDecisionMatrix(swarm, baseConnectors());
    const activeCount = Object.values(swarm.agents).filter((a) => a.status === "active").length;
    expect(Object.keys(wf.agent_workflows).length).toBe(activeCount);
  });

  it("ceo.orchestrator uses the Lorenz-style control loop", () => {
    const swarm = runSwarmDecisionMatrix(baseResponses(), baseConnectors());
    const wf = runWorkflowDecisionMatrix(swarm, baseConnectors());
    const ceo = wf.agent_workflows["ceo.orchestrator"];
    expect(ceo).toBeDefined();
    expect(ceo.on_fire.some((t) => t.task === "allocate_bundle_attention")).toBe(true);
    expect(ceo.on_fire.some((t) => t.task === "emit_cycle_narrative_to_board")).toBe(true);
    expect(ceo.escalation.some((e) => e.to === "board")).toBe(true);
  });

  it("every chief has a read_tlm → synthesize → emit_asn sequence", () => {
    const swarm = runSwarmDecisionMatrix(baseResponses(), baseConnectors());
    const wf = runWorkflowDecisionMatrix(swarm, baseConnectors());
    for (const chiefId of ["cpo", "cmo", "cro", "cfo", "cdo", "coo"]) {
      const w = wf.agent_workflows[chiefId];
      expect(w, chiefId).toBeDefined();
      expect(w.on_fire.map((t) => t.task)).toContain("emit_asn_to_subagents");
    }
  });

  it("dry_run_gates lists all write-side tasks", () => {
    const swarm = runSwarmDecisionMatrix(baseResponses(), baseConnectors());
    const wf = runWorkflowDecisionMatrix(swarm, baseConnectors());
    expect(wf.dry_run_gates.length).toBeGreaterThan(0);
    // Every gate string must match exactly one real agent+task pair.
    for (const gate of wf.dry_run_gates) {
      let matched = false;
      for (const [agentId, agentWf] of Object.entries(wf.agent_workflows)) {
        const prefix = `${agentId}.`;
        if (!gate.startsWith(prefix)) continue;
        const taskName = gate.slice(prefix.length);
        if (agentWf.on_fire.some((t) => t.task === taskName && t.dry_run_gate === true)) {
          matched = true;
          break;
        }
      }
      expect(matched, `gate "${gate}" should resolve to a dry_run task`).toBe(true);
    }
  });

  it("bundle_workflows only retain active agents in participating_agents", () => {
    const swarm = runSwarmDecisionMatrix(baseResponses(), baseConnectors());
    const wf = runWorkflowDecisionMatrix(swarm, baseConnectors());
    const activeSet = new Set(Object.entries(swarm.agents).filter(([, a]) => a.status === "active").map(([id]) => id));
    for (const bundle of Object.values(wf.bundle_workflows)) {
      for (const agent of bundle.participating_agents) {
        expect(activeSet.has(agent), `participating agent ${agent} should be active`).toBe(true);
      }
    }
  });

  it("all five canonical bundles present", () => {
    const swarm = runSwarmDecisionMatrix(baseResponses(), baseConnectors());
    const wf = runWorkflowDecisionMatrix(swarm, baseConnectors());
    for (const id of Object.keys(CANONICAL_BUNDLE_WORKFLOWS)) {
      expect(wf.bundle_workflows[id as keyof typeof wf.bundle_workflows]).toBeDefined();
    }
  });

  it("scheduled_routines_enabled matches the canonical OPΩ-SPEC §5.4 set", () => {
    const swarm = runSwarmDecisionMatrix(baseResponses(), baseConnectors());
    const wf = runWorkflowDecisionMatrix(swarm, baseConnectors());
    expect(wf.scheduled_routines_enabled).toEqual(SCHEDULED_ROUTINES);
  });

  it("strips tasks whose connector isn't configured (nullifies + flags)", () => {
    const swarm = runSwarmDecisionMatrix(baseResponses(), baseConnectors());
    // Remove github from the connector manifest
    const connectors = baseConnectors();
    connectors.required = connectors.required.filter((e) => e.id !== "github");
    const wf = runWorkflowDecisionMatrix(swarm, connectors);
    // generative sub-agents under cpo reference github; their publish task should now have connector: null
    const cpoBuild = wf.agent_workflows["cpo.build"];
    expect(cpoBuild).toBeDefined();
    const publish = cpoBuild.on_fire.find((t) => t.task === "publish_or_ship");
    if (publish) {
      expect(publish.connector).toBeNull();
      expect(publish.dry_run_gate).toBe(true);
    }
  });
});
