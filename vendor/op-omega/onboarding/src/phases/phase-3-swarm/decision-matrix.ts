/**
 * Phase 3 decision matrix — prunes, parks, and parameterizes the 33-agent
 * base roster based on pillar_responses + connector_manifest signals.
 *
 * Rules implemented per OPΩ-ONB-002 §E, adapted to Operator Ω's connector
 * registry (Supabase is the financial-data substrate; Stripe is not wired).
 */

import { createHash } from "node:crypto";
import type { PillarResponses } from "../../schema/pillar-responses.js";
import type { ConnectorManifest } from "../../schema/connector-manifest.js";
import {
  SWARM_MANIFEST_SCHEMA_VERSION,
  type SwarmManifest,
  type AgentManifestEntry,
  type SpawnEligibilityEntry,
} from "../../schema/swarm-manifest.js";
import type { BundleAllocation } from "@op-omega/plugin-flywheel-kernel";
import { BASE_ROSTER, BASE_ROSTER_SIZE, rosterIndex } from "./base-roster.js";
import {
  evaluateAgent,
  CONNECTOR_TO_GATING_CREDENTIAL,
  type ActivationContext,
} from "./activation-rules.js";

export interface SwarmDecisionMatrixOptions {
  now?: Date;
  pillarResponsesHash?: string;
  connectorManifestHash?: string;
  generatedBy?: string;
  /**
   * Credential-vault state per credential_key (Credential Concierge integration).
   * When provided, connectors whose gating credential is `skipped`/`invalid` are
   * filtered out before activation evaluation, and any agent that ends up
   * `standby` waiting on a credential-blocked connector is upgraded to `parked`
   * with an explicit credential unpark_condition. Omitting this preserves the
   * pre-concierge behavior — backwards-compatible.
   */
  credentialStatus?: Record<string, "valid" | "skipped" | "invalid" | "unvalidated">;
}

export function hashConnectorManifest(m: ConnectorManifest): string {
  const canon = JSON.stringify({
    schema_version: m.schema_version,
    required: m.required,
    suggested: m.suggested,
    deferred: m.deferred,
  });
  return `sha256:${createHash("sha256").update(canon).digest("hex")}`;
}

function connectorIds(m: ConnectorManifest): Set<string> {
  return new Set([...m.required, ...m.suggested].map((e) => e.id));
}

/**
 * Stage base allocations. Keyed by pillar_3.stage (free string). Unknown
 * stages fall through to the balanced default.
 *
 * Each row sums to 1.0. Tuned so that neighbouring stages differ by an L1
 * distance ≥ 0.20 — large enough to be detectable in Suite 1 divergence
 * tests, calibrated to the differential-equation claim.
 */
// @tunable phase3.stage_base_allocations
const STAGE_BASE_ALLOCATIONS: Record<string, BundleAllocation> = {
  pre_product:       { insight_activation: 0.35, pipeline_velocity: 0.05, expansion_engine: 0.10, unit_economics: 0.20, strategic_positioning: 0.30 },
  less_than_10k_mrr: { insight_activation: 0.25, pipeline_velocity: 0.30, expansion_engine: 0.10, unit_economics: 0.15, strategic_positioning: 0.20 },
  "10k_100k_mrr":    { insight_activation: 0.15, pipeline_velocity: 0.25, expansion_engine: 0.20, unit_economics: 0.20, strategic_positioning: 0.20 },
  "100k_1m_mrr":     { insight_activation: 0.10, pipeline_velocity: 0.15, expansion_engine: 0.30, unit_economics: 0.25, strategic_positioning: 0.20 },
  more_than_1m_mrr:  { insight_activation: 0.10, pipeline_velocity: 0.10, expansion_engine: 0.35, unit_economics: 0.25, strategic_positioning: 0.20 },
};

// @tunable phase3.balanced_default
const BALANCED_DEFAULT: BundleAllocation = {
  insight_activation: 0.20,
  pipeline_velocity: 0.20,
  expansion_engine: 0.20,
  unit_economics: 0.20,
  strategic_positioning: 0.20,
};

/**
 * GTM delta applied on top of the stage base. Values are signed adjustments
 * that feed clamp + renormalize downstream.
 */
// @tunable phase3.gtm_delta
function gtmDelta(gtm: string | undefined): Partial<BundleAllocation> {
  switch (gtm) {
    case "OUTBOUND_HIGH_TOUCH_SAAS":
    case "OUTBOUND_MID_MARKET":
      return { pipeline_velocity: 0.10, unit_economics: 0.05 };
    case "INBOUND_PLG":
    case "INBOUND_MID_TOUCH":
      return { insight_activation: 0.10, unit_economics: -0.05 };
    case "CONTENT_LED_PLG":
      return { insight_activation: 0.05, strategic_positioning: 0.05 };
    case "REFERRAL_LED":
      return { expansion_engine: 0.10 };
    case "BOOTSTRAP_NO_GTM":
      return { unit_economics: 0.10 };
    default:
      return {};
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Industry-aware allocation deltas (Sprint 2b · Lever B).
 * Layered on top of stage + GTM. Small magnitudes so deltas compose across
 * dimensions without dominating.
 */
// @tunable phase3.industry_delta
function industryDelta(industry: string | undefined): Partial<BundleAllocation> {
  switch (industry) {
    case "fintech":
    case "fintech_retail":
      return { unit_economics: 0.05, strategic_positioning: -0.03 };  // compliance-efficiency lens
    case "healthtech":
    case "legal_tech":
      return { strategic_positioning: 0.05, unit_economics: 0.02 };  // category-trust narrative + compliance
    case "dtc_ecommerce":
    case "consumer_mobile":
      return { insight_activation: 0.05, pipeline_velocity: -0.03 };  // activation is primary lever
    case "dev_tools":
    case "dev_infrastructure":
      return { insight_activation: 0.03, strategic_positioning: 0.03 };  // build cadence + community positioning
    case "enterprise_saas":
      return { expansion_engine: 0.05, pipeline_velocity: -0.03 };  // account mining > new-logo velocity
    case "marketplace":
      return { expansion_engine: 0.03, insight_activation: 0.03 };  // both-sided liquidity focus
    default:
      return {};
  }
}

function seedBundleAllocation(responses: PillarResponses): BundleAllocation {
  const stage = responses.pillar_3?.stage ?? "";
  const base = STAGE_BASE_ALLOCATIONS[stage] ?? BALANCED_DEFAULT;

  const gtm = gtmDelta(responses.pillar_4?.gtm_profile_enum);
  const ind = industryDelta(responses.pillar_1?.industry_hint);
  const raw: BundleAllocation = {
    insight_activation: base.insight_activation + (gtm.insight_activation ?? 0) + (ind.insight_activation ?? 0),
    pipeline_velocity: base.pipeline_velocity + (gtm.pipeline_velocity ?? 0) + (ind.pipeline_velocity ?? 0),
    expansion_engine: base.expansion_engine + (gtm.expansion_engine ?? 0) + (ind.expansion_engine ?? 0),
    unit_economics: base.unit_economics + (gtm.unit_economics ?? 0) + (ind.unit_economics ?? 0),
    strategic_positioning: base.strategic_positioning + (gtm.strategic_positioning ?? 0) + (ind.strategic_positioning ?? 0),
  };

  // Clamp each weight to [0.05, 0.50] then renormalize to sum = 1.0.
  // @tunable phase3.clamp_bounds
  const clamped: BundleAllocation = {
    insight_activation: clamp(raw.insight_activation, 0.05, 0.50),
    pipeline_velocity: clamp(raw.pipeline_velocity, 0.05, 0.50),
    expansion_engine: clamp(raw.expansion_engine, 0.05, 0.50),
    unit_economics: clamp(raw.unit_economics, 0.05, 0.50),
    strategic_positioning: clamp(raw.strategic_positioning, 0.05, 0.50),
  };

  const total =
    clamped.insight_activation +
    clamped.pipeline_velocity +
    clamped.expansion_engine +
    clamped.unit_economics +
    clamped.strategic_positioning;

  return {
    insight_activation: round(clamped.insight_activation / total),
    pipeline_velocity: round(clamped.pipeline_velocity / total),
    expansion_engine: round(clamped.expansion_engine / total),
    unit_economics: round(clamped.unit_economics / total),
    strategic_positioning: round(clamped.strategic_positioning / total),
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function runSwarmDecisionMatrix(
  responses: PillarResponses,
  connectorManifest: ConnectorManifest,
  options: SwarmDecisionMatrixOptions = {},
): SwarmManifest {
  const now = options.now ?? new Date();

  const allConnectors = connectorIds(connectorManifest);

  // Filter out connectors whose gating credential is skipped or invalid. Handles
  // OR-dependencies naturally — `cdo.signal` (supabase OR mixpanel) activates if
  // either credential is valid; only parks when both are blocked.
  const credentialBlockedConnectors = new Map<string, string>();
  if (options.credentialStatus) {
    for (const connector of allConnectors) {
      const credentialKey = CONNECTOR_TO_GATING_CREDENTIAL[connector];
      if (!credentialKey) continue;
      const status = options.credentialStatus[credentialKey];
      if (status === "skipped" || status === "invalid") {
        credentialBlockedConnectors.set(connector, credentialKey);
      }
    }
  }
  const effectiveConnectors = new Set(
    [...allConnectors].filter((c) => !credentialBlockedConnectors.has(c)),
  );

  const gtm = responses.pillar_4?.gtm_profile_enum;
  const activationCtx: ActivationContext = {
    responses,
    connectors: effectiveConnectors,
    credentialStatus: options.credentialStatus,
  };

  // Start with a deep copy of the base roster, default status = "parked".
  // Each agent earns "active" (or stays "parked"/goes "disabled") based on its
  // activation rule. See activation-rules.ts for the positive signal model.
  const agents: Record<string, AgentManifestEntry> = {};
  for (const base of BASE_ROSTER) {
    const { id, ...rest } = base;
    const verdict = evaluateAgent(id, activationCtx);
    const entry: AgentManifestEntry = { ...rest };
    if (verdict.status === "active") {
      entry.status = "active";
      if (verdict.skill_overlay) entry.skill_overlay = verdict.skill_overlay;
    } else if (verdict.status === "standby") {
      // If the connector(s) this agent's waiting on are all credential-blocked,
      // the standby is misleading — the operator already engaged with the connectors,
      // they just haven't provided working credentials. Upgrade to parked.
      // `waiting_on_connector` may be a single slug ("supabase") or an OR-list
      // ("mixpanel or supabase") — we extract every known slug and require ALL of
      // them to be blocked before flipping. If even one matched slug is genuinely
      // absent (not in manifest at all), the standby is the right answer.
      const matchedSlugs: string[] = [];
      for (const slug of Object.keys(CONNECTOR_TO_GATING_CREDENTIAL)) {
        if (verdict.waiting_on_connector.includes(slug)) matchedSlugs.push(slug);
      }
      const allMatchedBlocked =
        matchedSlugs.length > 0 && matchedSlugs.every((s) => credentialBlockedConnectors.has(s));
      if (allMatchedBlocked) {
        const credKeys = matchedSlugs.map((s) => credentialBlockedConnectors.get(s)!);
        const credList = credKeys.join(" or ");
        entry.status = "parked";
        entry.unpark_condition = `Provide a valid ${credList} via /credentials to activate (currently skipped/invalid).`;
        if (verdict.skill_overlay) entry.skill_overlay = verdict.skill_overlay;
      } else {
        entry.status = "standby";
        entry.waiting_on_connector = verdict.waiting_on_connector;
        if (verdict.skill_overlay) entry.skill_overlay = verdict.skill_overlay;
      }
    } else if (verdict.status === "parked") {
      entry.status = "parked";
      entry.unpark_condition = verdict.unpark_condition;
      if (verdict.skill_overlay) entry.skill_overlay = verdict.skill_overlay;
    } else {
      entry.status = "disabled";
      entry.reason = verdict.reason;
    }
    agents[id] = entry;
  }

  // Skill overlays on actively-routed agents — these are descriptive, not
  // status-changing. They ride on top of activation verdicts.
  const mutate = (
    id: string,
    patch: Partial<AgentManifestEntry> & { spawnable?: boolean },
  ): void => {
    if (!agents[id] || agents[id].status !== "active") return;
    agents[id] = { ...agents[id], ...patch };
  };

  if (gtm === "OUTBOUND_HIGH_TOUCH_SAAS" || gtm === "OUTBOUND_MID_MARKET") {
    mutate("cro.outbound", { spawnable: true, skill_overlay: "weight_up: primary spawn target per outbound GTM" });
    mutate("cro.demo", { skill_overlay: "weight_up: supports outbound GTM" });
    mutate("cro.close", { skill_overlay: "weight_up: supports outbound GTM" });
  }
  if (gtm === "INBOUND_PLG" || gtm === "CONTENT_LED_PLG" || gtm === "INBOUND_MID_TOUCH") {
    mutate("cmo.content", { skill_overlay: "weight_up: primary demand driver under content/PLG" });
    mutate("cpo.growth", { skill_overlay: "weight_up: activation loops matter most" });
  }
  if (gtm === "REFERRAL_LED") {
    mutate("cmo.advocacy", { skill_overlay: "weight_up: referral-led requires strong advocacy motion" });
    mutate("cro.expansion", { skill_overlay: "weight_up: referral loops extend expansion touchpoints" });
  }

  // cmo.demand rides on lead-source — if active but no ad connector, flag that
  // ad-bidding workflows are disabled without pausing the agent.
  const hasAdPlatform = effectiveConnectors.has("meta-ads-api") || effectiveConnectors.has("google-ads-api");
  if (!hasAdPlatform && agents["cmo.demand"]?.status === "active") {
    agents["cmo.demand"] = {
      ...agents["cmo.demand"],
      skill_overlay: "ad_bidding_workflows_disabled: no ad-platform connector in manifest",
    };
  }

  // === Build topology summary ===
  const statusCounts = { active: 0, standby: 0, parked: 0, disabled: 0 };
  for (const e of Object.values(agents)) {
    statusCounts[e.status] += 1;
  }

  // === Build spawn_eligibility list ===
  const spawnEligibility: SpawnEligibilityEntry[] = [];
  for (const [id, entry] of Object.entries(agents)) {
    if (entry.spawnable && entry.status === "active") {
      spawnEligibility.push({
        agent: id,
        marker: "S+",
        rationale: entry.skill_overlay ?? `Default S+ eligibility per base roster rules`,
      });
    }
  }

  return {
    schema_version: SWARM_MANIFEST_SCHEMA_VERSION,
    generated_at: now.toISOString(),
    generated_by: options.generatedBy ?? "T0 · decision-matrix-fallback",
    based_on: {
      pillar_responses_hash: options.pillarResponsesHash ?? "",
      connector_manifest_hash: options.connectorManifestHash ?? "",
    },
    topology: {
      total_base_roster: BASE_ROSTER_SIZE,
      active_count: statusCounts.active,
      standby_count: statusCounts.standby,
      parked_count: statusCounts.parked,
      disabled_count: statusCounts.disabled,
    },
    agents,
    spawn_eligibility: spawnEligibility,
    bundle_allocation_initial: seedBundleAllocation(responses),
  };
}

export { rosterIndex };
