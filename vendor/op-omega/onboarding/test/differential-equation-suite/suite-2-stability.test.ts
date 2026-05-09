/**
 * OPΩ-ONB-TEST-001-rev2 · Suite 2 · Stability · Deterministic Mapping
 *
 * Hypothesis: same inputs → identical manifests modulo timestamps; near-
 * duplicate inputs → bounded structural diffs.
 *
 * Two layers of determinism:
 *   A · Strict (skipInference=true): manifest_hash must be byte-identical
 *       across runs of the same fixture + seed. This proves the deterministic
 *       decision-matrix pipeline is truly reproducible.
 *
 *   B · Structural (live T2): rationale/overlay text is allowed to drift but
 *       structural shape (connector set, agent status map, allocation
 *       weights, dry_run_gates list) must stay equal. Requires a structural
 *       hash that strips free-form text.
 *
 * Default mode: A (fast, reliable). B requires OP_OMEGA_TEST_LIVE=1 and
 * must tolerate small text-level drift.
 */

import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { runOnboardingPipeline, type OnboardingFixture } from "./harness/run-onboarding-pipeline.js";
import type { CompanyManifest } from "../../src/index.js";

const MC_SEED = 42;
const RUN_LIVE = process.env.OP_OMEGA_TEST_LIVE === "1";

const baseFixture: OnboardingFixture = {
  fixture_id: "stability-base",
  description: "Stability-suite reference fixture",
  pillar_1: {
    org_name: "Acme Tools",
    input: "https://acme.example",
    mocked_enrichment: {
      company_context: "B2B SaaS workflow automation for ops teams.",
      has_product: true,
      industry_hint: "b2b_saas",
      business_model_hint: "subscription",
    },
  },
  pillar_2: {
    claude_plan: "max_20x",
    mocked_shell_result: { exit_code: 0, stdout: "OK" },
  },
  pillar_3: { product_state: "live_paying_customers", stage: "10k_100k_mrr" },
  pillar_4: { lead_source: "outbound_cold", sales_motion: "high_touch_enterprise", close_channel: "mostly_phone_video" },
  pillar_5: { comm_channel: "slack", urgency_routing: "digest_plus_urgent_phone" },
};

/**
 * Structural hash: strips rationale/overlay/task text, keeps status + counts +
 * allocations + dry_run_gates. Used for live-T2 stability checks where the
 * LLM will re-word rationales on every call.
 */
function structuralHash(m: CompanyManifest): string {
  const s = {
    connector_ids: {
      required: m.connector_manifest.required.map((c) => c.id).sort(),
      suggested: m.connector_manifest.suggested.map((c) => c.id).sort(),
      deferred: m.connector_manifest.deferred.map((c) => c.id).sort(),
    },
    swarm_topology: m.swarm_manifest.topology,
    swarm_agents_status: Object.fromEntries(
      Object.entries(m.swarm_manifest.agents).map(([id, a]) => [id, { status: a.status, spawnable: a.spawnable }]),
    ),
    spawn_eligibility_ids: m.swarm_manifest.spawn_eligibility.map((s) => s.agent).sort(),
    bundle_allocation_initial: m.swarm_manifest.bundle_allocation_initial,
    workflow_agents: Object.keys(m.workflow_manifest.agent_workflows).sort(),
    dry_run_gates: [...m.workflow_manifest.dry_run_gates].sort(),
  };
  return `sha256:${createHash("sha256").update(JSON.stringify(s)).digest("hex")}`;
}

/** Recursively strips known timestamp fields so identical inputs produce identical hashes. */
function stripTimestamps(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(stripTimestamps);
  if (typeof value !== "object") return value;
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const TIMESTAMP_KEYS = new Set([
    "t", "started_at", "enriched_at", "verified_at", "generated_at", "finalized_at", "completed_at", "computedAt", "asOf", "createdAt", "updatedAt", "dry_run_expires_at", "claude5hWindowResetsAt", "claudeWeeklyWindowResetsAt",
  ]);
  for (const [k, v] of Object.entries(obj)) {
    if (TIMESTAMP_KEYS.has(k)) continue;
    out[k] = stripTimestamps(v);
  }
  return out;
}

function nonTimestampHash(m: CompanyManifest): string {
  const s = stripTimestamps({
    pillar_responses: {
      pillar_1: m.pillar_responses.pillar_1,
      pillar_2: m.pillar_responses.pillar_2,
      pillar_3: m.pillar_responses.pillar_3,
      pillar_4: m.pillar_responses.pillar_4,
      pillar_5: m.pillar_responses.pillar_5,
    },
    connector_manifest: {
      required: m.connector_manifest.required,
      suggested: m.connector_manifest.suggested,
      deferred: m.connector_manifest.deferred,
      blocked: m.connector_manifest.blocked_on_manual_approval,
    },
    swarm_manifest: {
      topology: m.swarm_manifest.topology,
      agents: m.swarm_manifest.agents,
      spawn_eligibility: m.swarm_manifest.spawn_eligibility,
      bundle_allocation_initial: m.swarm_manifest.bundle_allocation_initial,
    },
    workflow_manifest: {
      agent_workflows: m.workflow_manifest.agent_workflows,
      bundle_workflows: m.workflow_manifest.bundle_workflows,
      scheduled_routines_enabled: m.workflow_manifest.scheduled_routines_enabled,
      dry_run_gates: [...m.workflow_manifest.dry_run_gates].sort(),
    },
    mc_winner: m.mc_winner,
  });
  return `sha256:${createHash("sha256").update(JSON.stringify(s)).digest("hex")}`;
}

describe("Suite 2 · Stability", () => {
  it("strict: three runs with same fixture + seed + skipInference produce identical manifest content", async () => {
    const r1 = await runOnboardingPipeline(baseFixture, { skipInference: true, mcSeed: MC_SEED });
    const r2 = await runOnboardingPipeline(baseFixture, { skipInference: true, mcSeed: MC_SEED });
    const r3 = await runOnboardingPipeline(baseFixture, { skipInference: true, mcSeed: MC_SEED });

    const h1 = nonTimestampHash(r1.companyManifest);
    const h2 = nonTimestampHash(r2.companyManifest);
    const h3 = nonTimestampHash(r3.companyManifest);

    expect(h1).toBe(h2);
    expect(h2).toBe(h3);
  }, 600_000);

  it("strict: near-duplicate inputs produce structurally identical manifests (skipInference)", async () => {
    const nearDup: OnboardingFixture = {
      ...baseFixture,
      fixture_id: "stability-near-dup",
      pillar_1: {
        ...baseFixture.pillar_1,
        input: "https://ACME.Example",  // case change
        mocked_enrichment: {
          ...baseFixture.pillar_1.mocked_enrichment,
          company_context: "B2B SaaS workflow automation for ops teams.  ", // trailing whitespace
        },
      },
    };
    const ra = await runOnboardingPipeline(baseFixture, { skipInference: true, mcSeed: MC_SEED });
    const rb = await runOnboardingPipeline(nearDup, { skipInference: true, mcSeed: MC_SEED });

    // Structural hash should be equal (free-form text differences allowed).
    expect(structuralHash(ra.companyManifest)).toBe(structuralHash(rb.companyManifest));
  }, 600_000);

  it.skipIf(!RUN_LIVE)(
    "structural (live T2): same inputs produce structurally identical manifests across runs",
    async () => {
      const r1 = await runOnboardingPipeline(baseFixture, { skipInference: false, mcSeed: MC_SEED });
      const r2 = await runOnboardingPipeline(baseFixture, { skipInference: false, mcSeed: MC_SEED });

      // T2 will produce different rationale text each run, so the byte-exact
      // hash differs. The structural hash (connectors, agent statuses,
      // allocations, dry_run_gates) must be equal.
      expect(structuralHash(r1.companyManifest)).toBe(structuralHash(r2.companyManifest));
    },
    1_800_000,
  );
});
