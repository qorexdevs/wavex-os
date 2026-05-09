/**
 * Phase 3 · swarm_manifest generator.
 *
 *   inputs:  pillar_responses.json + connector_manifest.json
 *   outputs: swarm_manifest.yaml + swarm_manifest.json
 */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import yaml from "js-yaml";
import { route } from "@op-omega/plugin-tier-router";
import type { BundleAllocation } from "@op-omega/plugin-flywheel-kernel";
import type { PillarResponses } from "../../schema/pillar-responses.js";
import type { ConnectorManifest } from "../../schema/connector-manifest.js";
import {
  SWARM_MANIFEST_SCHEMA_VERSION,
  type SwarmManifest,
  type AgentManifestEntry,
  type AgentStatus,
  type SpawnEligibilityEntry,
} from "../../schema/swarm-manifest.js";
import { runSwarmDecisionMatrix, hashConnectorManifest } from "./decision-matrix.js";
import { buildPhase3Prompt } from "./prompt.js";
import { sessionPaths, writeArtifact } from "../../state/session.js";

// @tunable phase3.valid_statuses
const VALID_STATUSES: AgentStatus[] = ["active", "parked", "disabled"];

export interface GenerateSwarmManifestInput {
  companyId: string;
  responses: PillarResponses;
  connectorManifest: ConnectorManifest;
  skipInference?: boolean;
  now?: Date;
  /**
   * Credential-vault state per credential_key. When provided, threads through to
   * `runSwarmDecisionMatrix` so connectors whose gating credential is `skipped`/`invalid`
   * are filtered before activation evaluation, and dependent agents flip to `parked`.
   */
  credentialStatus?: Record<string, "valid" | "skipped" | "invalid" | "unvalidated">;
}

export interface GenerateSwarmManifestResult {
  manifest: SwarmManifest;
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

function coerceAgent(raw: unknown, baseline: AgentManifestEntry): AgentManifestEntry | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  // Status + unpark/reason are deterministic (activation-rules.ts). T2 cannot
  // flip them, matching the same pattern as bundle_allocation_initial (Fix 4).
  // Only skill_overlay is T2-editable.
  const merged: AgentManifestEntry = { ...baseline };
  // @tunable phase3.skill_overlay_slice
  if (typeof o.skill_overlay === "string") merged.skill_overlay = o.skill_overlay.slice(0, 400);
  else if (o.skill_overlay === null) merged.skill_overlay = null;
  return merged;
}

function coerceBundleAllocation(raw: unknown, baseline: BundleAllocation): BundleAllocation {
  if (typeof raw !== "object" || raw === null) return baseline;
  const o = raw as Record<string, unknown>;
  const keys: (keyof BundleAllocation)[] = [
    "insight_activation",
    "pipeline_velocity",
    "expansion_engine",
    "unit_economics",
    "strategic_positioning",
  ];
  const out: BundleAllocation = { ...baseline };
  let total = 0;
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
      out[k] = v;
      total += v;
    } else {
      // Missing key → fall back to baseline
      return baseline;
    }
  }
  if (total <= 0) return baseline;
  // Normalize to 1.0
  for (const k of keys) out[k] = Math.round((out[k] / total) * 100) / 100;
  return out;
}

function coerceSpawnEligibility(raw: unknown): SpawnEligibilityEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: SpawnEligibilityEntry[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    if (typeof o.agent !== "string" || typeof o.rationale !== "string") continue;
    // @tunable phase3.spawn_rationale_slice
    out.push({ agent: o.agent, marker: "S+", rationale: o.rationale.slice(0, 300) });
  }
  return out;
}

function validateT2Manifest(raw: unknown, baseline: SwarmManifest): SwarmManifest | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;

  const agents: Record<string, AgentManifestEntry> = {};
  const rawAgents = typeof o.agents === "object" && o.agents !== null ? (o.agents as Record<string, unknown>) : null;
  if (!rawAgents) return null;
  for (const [id, baselineEntry] of Object.entries(baseline.agents)) {
    // If T2 returned this agent, coerce; else keep baseline.
    const next = rawAgents[id] !== undefined ? coerceAgent(rawAgents[id], baselineEntry) : baselineEntry;
    agents[id] = next ?? baselineEntry;
  }

  // `bundle_allocation_initial` is deterministic (stage × GTM rules in decision-matrix).
  // Ignore whatever T2 returned and always use the baseline — the prompt says hands-off
  // but T2 ignores the instruction often enough that we need to enforce in code.
  const bundleAllocation = baseline.bundle_allocation_initial;
  const spawnEligibility = coerceSpawnEligibility(o.spawn_eligibility);

  // Recompute topology from the coerced agents (T2 may have been wrong about counts).
  // `standby` was added to the AgentStatus union when activation rules grew the
  // OR-dependency case (cdo.signal etc.); the counts object now needs it too.
  const counts: Record<AgentStatus, number> = { active: 0, standby: 0, parked: 0, disabled: 0 };
  for (const a of Object.values(agents)) counts[a.status] += 1;

  return {
    schema_version: SWARM_MANIFEST_SCHEMA_VERSION,
    generated_at: baseline.generated_at,
    generated_by: baseline.generated_by,
    based_on: baseline.based_on,
    topology: {
      total_base_roster: baseline.topology.total_base_roster,
      active_count: counts.active,
      standby_count: counts.standby,
      parked_count: counts.parked,
      disabled_count: counts.disabled,
    },
    agents,
    spawn_eligibility: spawnEligibility.length > 0 ? spawnEligibility : baseline.spawn_eligibility,
    bundle_allocation_initial: bundleAllocation,
  };
}

export async function generateSwarmManifest(
  input: GenerateSwarmManifestInput,
): Promise<GenerateSwarmManifestResult> {
  const warnings: string[] = [];
  const now = input.now ?? new Date();
  const pillarHash = hashPillars(input.responses);
  const connectorHash = hashConnectorManifest(input.connectorManifest);

  const baseline = runSwarmDecisionMatrix(input.responses, input.connectorManifest, {
    now,
    pillarResponsesHash: pillarHash,
    connectorManifestHash: connectorHash,
    generatedBy: "T0 · decision-matrix-fallback",
    credentialStatus: input.credentialStatus,
  });

  let manifest: SwarmManifest = baseline;
  let source: "t2" | "fallback" = "fallback";

  if (!input.skipInference) {
    try {
      const resp = await route({
        agent_id: "onboarding.phase-3",
        prompt: buildPhase3Prompt(input.responses, input.connectorManifest, baseline),
        task_metadata: {
          creativity_required: false,
          customer_facing: false,
          reasoning_depth: "deep",
          priority: "high",
        },
        companyId: input.companyId,
        outputFormat: "json",
        // @tunable phase3.t2_timeout_ms
        timeout_ms: 120_000,
      });
      if (resp.warnings) warnings.push(...resp.warnings);

      const match = resp.output.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        const validated = validateT2Manifest(parsed, baseline);
        if (validated) {
          manifest = { ...validated, generated_by: "T2 · onboarding/phase-3" };
          source = "t2";
        } else {
          warnings.push("T2 response did not validate against swarm manifest shape; kept baseline");
        }
      } else {
        warnings.push("T2 response contained no JSON object; kept baseline");
      }
    } catch (err) {
      warnings.push(
        `T2 generation failed: ${err instanceof Error ? err.message : String(err)}; kept baseline`,
      );
    }
  }

  const finalManifest: SwarmManifest = {
    ...manifest,
    generated_at: now.toISOString(),
    generated_by: source === "t2" ? "T2 · onboarding/phase-3" : "T0 · decision-matrix-fallback",
  };

  const yamlPath = await writeArtifact(
    input.companyId,
    "swarm_manifest.yaml",
    yaml.dump(finalManifest, { indent: 2, lineWidth: 120, noRefs: true }),
  );
  const jsonPath = await writeArtifact(
    input.companyId,
    "swarm_manifest.json",
    JSON.stringify(finalManifest, null, 2),
  );

  return { manifest: finalManifest, yamlPath, jsonPath, source, warnings };
}

/**
 * Load the prior Phase 2 connector_manifest.json from disk. Required input
 * for Phase 3 generation — returns null when Phase 2 hasn't been run.
 */
export async function loadConnectorManifest(
  companyId: string,
  overrideRoot?: string,
): Promise<ConnectorManifest | null> {
  const paths = sessionPaths(companyId, overrideRoot);
  try {
    const raw = await readFile(join(paths.onboardingDir, "connector_manifest.json"), "utf8");
    return JSON.parse(raw) as ConnectorManifest;
  } catch {
    return null;
  }
}
