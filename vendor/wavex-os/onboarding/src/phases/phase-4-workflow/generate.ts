/**
 * Phase 4 · workflow_manifest generator.
 *
 *   inputs:  pillar_responses.json + connector_manifest.json + swarm_manifest.json
 *   outputs: workflow_manifest.yaml + workflow_manifest.json
 */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import yaml from "js-yaml";
import { route, fetchBudgetSnapshotWithRetry } from "@wavex-os/plugin-tier-router";
import { OnboardingHaltError } from "../../errors.js";
import type { PillarResponses } from "../../schema/pillar-responses.js";
import type { ConnectorManifest } from "../../schema/connector-manifest.js";
import type { SwarmManifest } from "../../schema/swarm-manifest.js";
import {
  WORKFLOW_MANIFEST_SCHEMA_VERSION,
  type WorkflowManifest,
  type AgentWorkflow,
  type WorkflowTask,
  type WorkflowTier,
  type FlowType,
  type EscalationTrigger,
  type T2PatchRecord,
} from "../../schema/workflow-manifest.js";
import { runWorkflowDecisionMatrix, hashSwarmManifest } from "./decision-matrix.js";
import { buildPhase4Prompt } from "./prompt.js";
import { sessionPaths, writeArtifact } from "../../state/session.js";
import { collectDryRunGates } from "./workflow-templates.js";

// @tunable phase4.valid_tiers
const VALID_TIERS: WorkflowTier[] = ["T0", "T1", "T2"];
// @tunable phase4.valid_flows
const VALID_FLOWS: FlowType[] = ["ASN", "TLM", "CON", "VAL"];

export interface GenerateWorkflowManifestInput {
  companyId: string;
  responses: PillarResponses;
  connectorManifest: ConnectorManifest;
  swarmManifest: SwarmManifest;
  skipInference?: boolean;
  now?: Date;
  /** Explicit operator override — proceed even if budget plugin is unreachable.
   *  Writes an anomaly flag on the final manifest. */
  bypassBudgetCheck?: boolean;
  /** Override the paperclip base URL used for the budget pre-flight. */
  paperclipBaseUrl?: string;
}

export interface GenerateWorkflowManifestResult {
  manifest: WorkflowManifest;
  yamlPath: string;
  jsonPath: string;
  source: "t2" | "fallback";
  warnings: string[];
}

function hashPillars(r: PillarResponses): string {
  const canon = JSON.stringify({
    schema_version: r.schema_version,
    pillar_1: r.pillar_1,
    pillar_2: r.pillar_2,
    pillar_3: r.pillar_3,
    pillar_4: r.pillar_4,
    pillar_5: r.pillar_5,
  });
  return `sha256:${createHash("sha256").update(canon).digest("hex")}`;
}

function hashConnector(m: ConnectorManifest): string {
  const canon = JSON.stringify({
    schema_version: m.schema_version,
    required: m.required,
    suggested: m.suggested,
    deferred: m.deferred,
  });
  return `sha256:${createHash("sha256").update(canon).digest("hex")}`;
}

function coerceTask(raw: unknown): WorkflowTask | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.task !== "string" || !o.task) return null;
  // @tunable phase4.slice_caps
  const task: WorkflowTask = { task: o.task.slice(0, 120) };
  if (typeof o.tier === "string" && VALID_TIERS.includes(o.tier as WorkflowTier)) task.tier = o.tier as WorkflowTier;
  if (typeof o.flow_type === "string" && VALID_FLOWS.includes(o.flow_type as FlowType)) task.flow_type = o.flow_type as FlowType;
  if (typeof o.connector === "string") task.connector = o.connector.slice(0, 60);
  else if (o.connector === null) task.connector = null;
  if (typeof o.input === "string") task.input = o.input.slice(0, 120);
  if (typeof o.expected_output === "string") task.expected_output = o.expected_output.slice(0, 120);
  if (typeof o.dry_run_gate === "boolean") task.dry_run_gate = o.dry_run_gate;
  if (typeof o.target === "string") task.target = o.target.slice(0, 60);
  return task;
}

function coerceEscalation(raw: unknown): EscalationTrigger[] {
  if (!Array.isArray(raw)) return [];
  const out: EscalationTrigger[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    if (typeof o.on !== "string" || typeof o.to !== "string") continue;
    out.push({ on: o.on.slice(0, 200), to: o.to.slice(0, 60) });
  }
  return out;
}

/**
 * Apply T2 patches to the workflow baseline. Requires attribution per patch:
 * rationale + pillar_signal. Patches missing attribution are discarded +
 * surfaced as warnings, not silently accepted.
 */
function applyT2Patch(
  baseline: WorkflowManifest,
  raw: unknown,
  validAgentIds: ReadonlySet<string>,
): { manifest: WorkflowManifest; patchRecords: T2PatchRecord[]; rejectedCount: number } {
  if (typeof raw !== "object" || raw === null) return { manifest: baseline, patchRecords: [], rejectedCount: 0 };
  const o = raw as Record<string, unknown>;
  const patches = Array.isArray(o.patches) ? o.patches : [];
  if (patches.length === 0) return { manifest: baseline, patchRecords: [], rejectedCount: 0 };

  const updated: Record<string, AgentWorkflow> = { ...baseline.agent_workflows };
  const patchRecords: T2PatchRecord[] = [];
  let rejectedCount = 0;

  for (const entry of patches) {
    if (typeof entry !== "object" || entry === null) { rejectedCount += 1; continue; }
    const p = entry as Record<string, unknown>;
    const agentId = typeof p.agent_id === "string" ? p.agent_id : null;
    const rationale = typeof p.rationale === "string" ? p.rationale.trim() : "";
    const pillarSignal = typeof p.pillar_signal === "string" ? p.pillar_signal.trim() : "";

    // Hard gate: attribution required.
    if (!agentId || !validAgentIds.has(agentId)) { rejectedCount += 1; continue; }
    if (rationale.length < 20) { rejectedCount += 1; continue; }
    if (!/pillar_[12345]\./i.test(pillarSignal)) { rejectedCount += 1; continue; }

    const base = updated[agentId];
    if (!base) { rejectedCount += 1; continue; }

    const next: AgentWorkflow = { ...base };
    const changedFields: string[] = [];

    if (Array.isArray(p.on_fire)) {
      const tasks = p.on_fire.map(coerceTask).filter(Boolean) as WorkflowTask[];
      // @tunable phase4.task_cap
      if (tasks.length > 0 && tasks.length <= 6) {
        next.on_fire = tasks;
        changedFields.push("on_fire");
      }
    }
    if (Array.isArray(p.escalation)) {
      const esc = coerceEscalation(p.escalation);
      if (esc.length > 0) {
        next.escalation = esc;
        changedFields.push("escalation");
      }
    }

    if (changedFields.length === 0) { rejectedCount += 1; continue; }

    updated[agentId] = next;
    patchRecords.push({
      agent_id: agentId,
      changed_fields: changedFields,
      // @tunable phase4.attribution_slices
      rationale: rationale.slice(0, 240),
      pillar_signal: pillarSignal.slice(0, 120),
    });
  }

  return {
    manifest: {
      ...baseline,
      agent_workflows: updated,
      dry_run_gates: collectDryRunGates(updated),
      t2_patches: patchRecords,
    },
    patchRecords,
    rejectedCount,
  };
}

export async function generateWorkflowManifest(
  input: GenerateWorkflowManifestInput,
): Promise<GenerateWorkflowManifestResult> {
  const warnings: string[] = [];

  // Pre-flight: budget enforcement must be reachable before a workflow manifest
  // can be generated — otherwise the dry_run gates and budget constraints in
  // the manifest would be advisory, not enforced. Operator can bypass with
  // explicit override (writes anomaly flag).
  if (!input.skipInference && !input.bypassBudgetCheck) {
    const baseUrl = input.paperclipBaseUrl ?? process.env.WAVEX_OS_PAPERCLIP_BASE_URL ?? "http://127.0.0.1:3102";
    const budget = await fetchBudgetSnapshotWithRetry(baseUrl, input.companyId);
    if (!budget.ok) {
      throw new OnboardingHaltError({
        code: "BUDGET_ENFORCEMENT_UNAVAILABLE",
        operator_message:
          "Budget enforcement is unavailable. This is required before your workflows can be generated so the spending limits in the manifest actually hold. Check that the budget plugin is running and retry.",
        engineer_detail: budget.error,
        allow_override: true,
      });
    }
  } else if (input.bypassBudgetCheck) {
    warnings.push("budget_enforcement_bypassed — operator accepted risk of unenforced budget gates");
  }

  const now = input.now ?? new Date();
  const baseline = runWorkflowDecisionMatrix(input.swarmManifest, input.connectorManifest, {
    now,
    pillarResponsesHash: hashPillars(input.responses),
    connectorManifestHash: hashConnector(input.connectorManifest),
    swarmManifestHash: hashSwarmManifest(input.swarmManifest),
    generatedBy: "T0 · decision-matrix-fallback",
  });

  let manifest: WorkflowManifest = baseline;
  let source: "t2" | "fallback" = "fallback";

  if (!input.skipInference) {
    try {
      const resp = await route({
        agent_id: "onboarding.phase-4",
        prompt: buildPhase4Prompt(input.responses, input.connectorManifest, input.swarmManifest, baseline),
        task_metadata: {
          creativity_required: false,
          customer_facing: false,
          reasoning_depth: "deep",
          priority: "high",
        },
        companyId: input.companyId,
        outputFormat: "json",
        // @tunable phase4.t2_timeout_ms
        timeout_ms: 180_000,
      });
      if (resp.warnings) warnings.push(...resp.warnings);

      // Specificity gate (Sprint 002 · Issue 5): after patches are accepted,
      // require that the rationales collectively cite ≥ 3 distinct pillar
      // signals OR at least 2 of the "differentiation signals" (product_maturity,
      // tone, friction, differentiator). If not, re-prompt up to 2x. After cap,
      // accept with a `shallow_customization` warning.
      let attempt = 0;
      let currentResp: typeof resp = resp;
      let accepted: { patchRecords: ReturnType<typeof applyT2Patch>["patchRecords"]; manifest: WorkflowManifest; rejectedCount: number } | null = null;
      const validAgentIds = new Set(Object.keys(baseline.agent_workflows));
      const diffSignals = ["product_maturity", "tone_signal", "primary_friction", "differentiator"];
      // @tunable phase4.reprompt_cap
      while (attempt <= 2) {
        const match = currentResp.output.match(/\{[\s\S]*\}/);
        if (!match) {
          warnings.push("T2 response contained no JSON object; kept baseline");
          break;
        }
        const parsed = JSON.parse(match[0]);
        const { manifest: patched, patchRecords, rejectedCount } = applyT2Patch(baseline, parsed, validAgentIds);
        if (patchRecords.length === 0) {
          warnings.push(rejectedCount > 0
            ? `T2 returned ${rejectedCount} patch${rejectedCount === 1 ? "" : "es"} but none had sufficient attribution; kept baseline`
            : "T2 returned no actionable patches; kept baseline");
          break;
        }

        const distinctSignals = new Set(patchRecords.map((p) => p.pillar_signal.split("=")[0]));
        const diffSignalsCited = diffSignals.filter((s) =>
          patchRecords.some((p) => p.pillar_signal.toLowerCase().includes(s) || p.rationale.toLowerCase().includes(s)),
        ).length;

        // Sprint 2b · Lever C: tightened gate. A patch set is specific if:
        //   (a) at least as many distinct signals as patches (no duplicates), OR
        //   (b) ≥ 5 distinct signals total (broad coverage), OR
        //   (c) ≥ 2 differentiation signals explicitly referenced
        // Tighter than v0.3.0 which accepted "≥ 3 distinct OR ≥ 2 diff".
        // @tunable phase4.specificity_gate
        const noDuplicates = distinctSignals.size >= patchRecords.length;
        const specific = noDuplicates || distinctSignals.size >= 5 || diffSignalsCited >= 2;
        if (specific || attempt >= 2) {
          accepted = { patchRecords, manifest: patched, rejectedCount };
          if (!specific) warnings.push("shallow_customization — T2 rationales repeated the same pillar signals after 2 retries");
          if (rejectedCount > 0) warnings.push(`${rejectedCount} proposed customization${rejectedCount === 1 ? "" : "s"} discarded for missing attribution`);
          break;
        }

        // Re-prompt with explicit instruction to pull from the differentiation signals.
        attempt += 1;
        const rePrompt = `${buildPhase4Prompt(input.responses, input.connectorManifest, input.swarmManifest, baseline)}

RE-PROMPT (attempt ${attempt + 1}):
Your previous customizations all cited a narrow set of pillar signals: ${[...distinctSignals].join(", ")}.
Rewrite with DISTINCT reasoning per agent. Each patch must pull from a different signal — especially the differentiation signals: product_maturity_signal, tone_signal, primary_friction_hypothesis, differentiator_hypothesis. Do not repeat the same pillar_signal across more than 2 patches.`;
        currentResp = await route({
          agent_id: "onboarding.phase-4",
          prompt: rePrompt,
          task_metadata: { creativity_required: false, customer_facing: false, reasoning_depth: "deep", priority: "high" },
          companyId: input.companyId,
          outputFormat: "json",
          timeout_ms: 180_000,
        });
        if (currentResp.warnings) warnings.push(...currentResp.warnings);
      }

      if (accepted) {
        manifest = accepted.manifest;
        source = "t2";
        warnings.push(`Customized ${accepted.patchRecords.length} capabilit${accepted.patchRecords.length === 1 ? "y" : "ies"} for your specific situation`);
      }
    } catch (err) {
      warnings.push(
        `T2 generation failed: ${err instanceof Error ? err.message : String(err)}; kept baseline`,
      );
    }
  }

  const finalManifest: WorkflowManifest = {
    ...manifest,
    generated_at: now.toISOString(),
    generated_by: source === "t2" ? "T2 · onboarding/phase-4" : "T0 · decision-matrix-fallback",
  };

  const yamlPath = await writeArtifact(
    input.companyId,
    "workflow_manifest.yaml",
    yaml.dump(finalManifest, { indent: 2, lineWidth: 120, noRefs: true }),
  );
  const jsonPath = await writeArtifact(
    input.companyId,
    "workflow_manifest.json",
    JSON.stringify(finalManifest, null, 2),
  );

  return { manifest: finalManifest, yamlPath, jsonPath, source, warnings };
}

/** Load prior Phase 3 swarm_manifest.json from disk. */
export async function loadSwarmManifest(
  companyId: string,
  overrideRoot?: string,
): Promise<SwarmManifest | null> {
  const paths = sessionPaths(companyId, overrideRoot);
  try {
    const raw = await readFile(join(paths.onboardingDir, "swarm_manifest.json"), "utf8");
    return JSON.parse(raw) as SwarmManifest;
  } catch {
    return null;
  }
}
