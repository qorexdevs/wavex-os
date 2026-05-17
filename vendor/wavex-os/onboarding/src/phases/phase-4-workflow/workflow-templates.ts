/**
 * Per-agent workflow templates — baseline `on_fire` sequences keyed off the
 * agent's id. Covers all 33 roster entries with a generic pattern per
 * archetype (chief / analytical / generative / outbound / ops). T2 refines
 * specific phrasing and connector bindings in the subsequent inference
 * pass.
 */

import type { AgentWorkflow, WorkflowTask } from "../../schema/workflow-manifest.js";
import type { AgentManifestEntry } from "../../schema/swarm-manifest.js";

function writeSideTask(agentId: string, base: WorkflowTask): WorkflowTask {
  return { ...base, dry_run_gate: true, flow_type: base.flow_type ?? "VAL" };
}

function escalateToParent(parent: string | null): { on: string; to: string }[] {
  if (!parent) return [];
  return [{ on: "unable_to_complete || kpi_drift_detected", to: parent }];
}

/** Chiefs (L·III): read TLM from sub-agents, emit ASN downward, escalate to CEO. */
function chiefWorkflow(agent: AgentManifestEntry): AgentWorkflow {
  return {
    heartbeat: agent.heartbeat,
    on_fire: [
      { task: "read_tlm_from_subagents", tier: "T0", flow_type: "TLM", expected_output: "dept_status" },
      { task: "synthesize_dept_state", tier: "T1", input: "dept_status", expected_output: "priorities" },
      { task: "emit_asn_to_subagents", tier: "T2", input: "priorities", flow_type: "ASN", expected_output: "bundle_task_assignments" },
    ],
    escalation: escalateToParent(agent.reports_to),
  };
}

/** CEO orchestrator: Lorenz-style control loop per OPΩ-SPEC §5.4. */
function ceoWorkflow(agent: AgentManifestEntry): AgentWorkflow {
  return {
    heartbeat: agent.heartbeat,
    on_fire: [
      { task: "read_kpi_state_vector", tier: "T0", flow_type: "TLM", expected_output: "kpi_history" },
      { task: "compute_flywheel_score", tier: "T0", input: "kpi_history", expected_output: "flywheel_score" },
      { task: "allocate_bundle_attention", tier: "T2", input: "flywheel_score", expected_output: "alpha_weights" },
      { task: "oscillate_explore", tier: "T0", input: "alpha_weights", expected_output: "adjusted_alpha" },
      { task: "emit_bundle_asn_to_csuite", tier: "T2", flow_type: "ASN", input: "adjusted_alpha", expected_output: "asn_batch" },
      { task: "emit_cycle_narrative_to_board", tier: "T2", flow_type: "TLM", expected_output: "system_voice" },
    ],
    escalation: [
      { on: "flywheel_score_lost_criticality", to: "board" },
      { on: "mc_winner_differs_3_cycles", to: "board" },
      { on: "cfo.capital.runway_alert", to: "board" },
    ],
  };
}

/** Analytical sub-agents (cdo.*, cfo.forecast): T1 classify + T2 synthesize. */
function analyticalSubWorkflow(agent: AgentManifestEntry): AgentWorkflow {
  return {
    heartbeat: agent.heartbeat,
    on_fire: [
      { task: "pull_recent_telemetry", tier: "T0", flow_type: "TLM", expected_output: "raw_events" },
      { task: "classify_or_score", tier: "T1", input: "raw_events", expected_output: "scored_events" },
      { task: "synthesize_insight", tier: "T2", input: "scored_events", expected_output: "insight_brief" },
      { task: "emit_tlm_to_chief", tier: "T0", flow_type: "TLM", input: "insight_brief" },
    ],
    escalation: escalateToParent(agent.reports_to),
  };
}

/** Generative sub-agents (cmo.content, cmo.brand, cpo.build, cpo.roadmap). */
function generativeSubWorkflow(agent: AgentManifestEntry): AgentWorkflow {
  return {
    heartbeat: agent.heartbeat,
    on_fire: [
      { task: "read_asn_from_chief", tier: "T0", flow_type: "ASN", expected_output: "task_brief" },
      { task: "draft_artifact", tier: "T1", input: "task_brief", expected_output: "draft" },
      { task: "brand_voice_gate", tier: "T2", input: "draft", expected_output: "polished_draft" },
      writeSideTask(agent.reports_to ?? "", {
        task: "publish_or_ship",
        tier: "T2",
        input: "polished_draft",
        expected_output: "shipped_artifact",
        connector: agent.reports_to === "cpo" ? "github" : null,
      }),
      { task: "emit_val_to_chief", tier: "T0", flow_type: "VAL", input: "shipped_artifact" },
    ],
    escalation: escalateToParent(agent.reports_to),
  };
}

/** Outbound sub-agents (cro.outbound, cmo.demand): T0 scoring + T1 personalize + T2 for high-stakes. */
function outboundSubWorkflow(agent: AgentManifestEntry): AgentWorkflow {
  return {
    heartbeat: agent.heartbeat,
    on_fire: [
      { task: "pull_new_leads", tier: "T0", flow_type: "TLM", expected_output: "lead_list" },
      { task: "score_leads", tier: "T0", input: "lead_list", expected_output: "scored_leads" },
      { task: "personalize_sequences", tier: "T1", input: "scored_leads", expected_output: "draft_sequences" },
      { task: "quality_gate_high_value", tier: "T2", input: "draft_sequences", expected_output: "approved_sequences" },
      writeSideTask(agent.reports_to ?? "", {
        task: "send_outbound_messages",
        tier: "T0",
        input: "approved_sequences",
        flow_type: "VAL",
        expected_output: "delivery_receipts",
      }),
      { task: "emit_val_to_chief", tier: "T0", flow_type: "VAL", input: "delivery_receipts" },
    ],
    escalation: [
      ...escalateToParent(agent.reports_to),
      { on: "lead_count_drops_gt_30pct_wow", to: agent.reports_to ?? "" },
    ],
  };
}

/** Close/demo/expansion: customer-facing T2 reasoning. */
function closingSubWorkflow(agent: AgentManifestEntry): AgentWorkflow {
  return {
    heartbeat: agent.heartbeat,
    on_fire: [
      { task: "read_pipeline_queue", tier: "T0", flow_type: "TLM", expected_output: "open_deals" },
      { task: "prepare_engagement_brief", tier: "T2", input: "open_deals", expected_output: "brief" },
      writeSideTask(agent.reports_to ?? "", {
        task: "execute_customer_action",
        tier: "T2",
        input: "brief",
        flow_type: "VAL",
        expected_output: "outcome",
      }),
      { task: "log_outcome_tlm", tier: "T0", flow_type: "TLM", input: "outcome" },
    ],
    escalation: escalateToParent(agent.reports_to),
  };
}

/** Capital + econ: math-heavy T0 plus a T2 narrative layer. */
function capitalSubWorkflow(agent: AgentManifestEntry): AgentWorkflow {
  return {
    heartbeat: agent.heartbeat,
    on_fire: [
      { task: "compute_marginal_roi_per_agent", tier: "T0", flow_type: "TLM", expected_output: "roi_table" },
      { task: "detect_drift", tier: "T0", input: "roi_table", expected_output: "drift_signal" },
      { task: "draft_reallocation", tier: "T0", input: "drift_signal", expected_output: "diff_plan" },
      { task: "narrate_diff_for_board", tier: "T2", input: "diff_plan", expected_output: "human_readable_diff" },
      writeSideTask(agent.reports_to ?? "", {
        task: "enforce_new_budgets",
        tier: "T0",
        input: "diff_plan",
        flow_type: "CON",
        expected_output: "applied",
      }),
    ],
    escalation: [
      ...escalateToParent(agent.reports_to),
      { on: "burn_multiple_gt_2_5 || runway_lt_12mo", to: "ceo.orchestrator" },
    ],
  };
}

/** Advocacy: customer testimonial pipeline, mostly VAL flow. */
function advocacySubWorkflow(agent: AgentManifestEntry): AgentWorkflow {
  return {
    heartbeat: agent.heartbeat,
    on_fire: [
      { task: "watch_for_closed_deals", tier: "T0", flow_type: "VAL", expected_output: "closed_accounts" },
      { task: "propose_case_study_candidates", tier: "T1", input: "closed_accounts", expected_output: "candidates" },
      writeSideTask(agent.reports_to ?? "", {
        task: "enroll_in_case_study_pipeline",
        tier: "T2",
        input: "candidates",
        flow_type: "VAL",
        expected_output: "enrolled",
      }),
      { task: "emit_val_to_cmo_content", tier: "T0", flow_type: "VAL", input: "enrolled" },
    ],
    escalation: escalateToParent(agent.reports_to),
  };
}

/** Ops sub-agents: fast, deterministic checks. */
function opsSubWorkflow(agent: AgentManifestEntry): AgentWorkflow {
  return {
    heartbeat: agent.heartbeat,
    on_fire: [
      { task: "run_check", tier: "T0", expected_output: "check_result" },
      { task: "summarize_if_anomaly", tier: "T1", input: "check_result", expected_output: "summary" },
      { task: "emit_tlm_to_coo", tier: "T0", flow_type: "TLM", input: "summary" },
    ],
    escalation: escalateToParent(agent.reports_to),
  };
}

/** Routes an agent to the correct template based on id/dept. */
// @tunable phase4.baseline_workflow_for
export function baselineWorkflowFor(id: string, agent: AgentManifestEntry): AgentWorkflow {
  if (id === "ceo.orchestrator") return ceoWorkflow(agent);
  if (agent.level === "L·III") return chiefWorkflow(agent);

  // L·IV routing by department + id
  if (agent.department === "data") return analyticalSubWorkflow(agent);
  if (id === "cfo.forecast") return analyticalSubWorkflow(agent);
  if (id === "cfo.capital" || id === "cfo.econ") return capitalSubWorkflow(agent);
  if (id === "cfo.treasury") return analyticalSubWorkflow(agent);

  if (id === "cmo.content" || id === "cmo.brand" || id === "cpo.build" || id === "cpo.roadmap" || id === "cpo.growth")
    return generativeSubWorkflow(agent);
  if (id === "cpo.qa") return analyticalSubWorkflow(agent);

  if (id === "cmo.demand" || id === "cro.outbound") return outboundSubWorkflow(agent);
  if (id === "cro.demo" || id === "cro.close" || id === "cro.expansion") return closingSubWorkflow(agent);
  if (id === "cmo.advocacy") return advocacySubWorkflow(agent);

  if (agent.department === "ops") return opsSubWorkflow(agent);

  // Fallback — generic chief pattern.
  return chiefWorkflow(agent);
}

export function collectDryRunGates(
  workflows: Record<string, AgentWorkflow>,
): string[] {
  const gates: string[] = [];
  for (const [agentId, wf] of Object.entries(workflows)) {
    for (const task of wf.on_fire) {
      if (task.dry_run_gate) gates.push(`${agentId}.${task.task}`);
    }
  }
  return gates.sort();
}
