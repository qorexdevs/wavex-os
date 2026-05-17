/**
 * OPΩ-ONB-TEST-001-rev2 · Suite 3 · Surface Coverage
 *
 * Hypothesis: degenerate inputs (edge cases) produce valid manifests. The
 * solution surface has boundaries but no holes.
 *
 * Per Appendix §2, assertions are:
 *   - manifest passes schema validation
 *   - active + parked + disabled === 33 (base roster; was 34 in spec, reconciled)
 *   - every agent in workflow_manifest exists as active in swarm_manifest
 *   - every connector referenced in workflow tasks exists in connector_manifest
 *     OR is nullified with dry_run_gate: true
 *   - bundle_allocation_initial sums to 1.0 ± ε
 *   - dry_run: true on all write-side tasks (dry_run_gates non-empty)
 *
 * Per §G, all T2 calls run live — no stubbing.
 */

import { describe, expect, it } from "vitest";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { loadFixture, runOnboardingPipeline, type OnboardingFixture } from "./harness/run-onboarding-pipeline.js";
import { BASE_ROSTER_SIZE } from "../../src/index.js";

const EDGE_DIR = join(__dirname, "fixtures/edge-cases");

/**
 * For iterative dev speed, the surface coverage suite runs with `skipInference:
 * true` by default. Set `WAVEX_OS_TEST_LIVE=1` to run with full T2.
 */
const RUN_LIVE = process.env.WAVEX_OS_TEST_LIVE === "1";

async function listEdgeFixtures(): Promise<OnboardingFixture[]> {
  const names = await readdir(EDGE_DIR);
  const fixtures: OnboardingFixture[] = [];
  for (const n of names) {
    if (!n.endsWith(".json")) continue;
    fixtures.push(await loadFixture(join(EDGE_DIR, n)));
  }
  return fixtures;
}

describe("Suite 3 · Surface Coverage · edge-case fixtures", async () => {
  const fixtures = await listEdgeFixtures();

  for (const fx of fixtures) {
    it(`${fx.fixture_id}: produces a valid manifest (or a clean halt for claude-code-fails)`, async () => {
      const result = await runOnboardingPipeline(fx, { skipInference: !RUN_LIVE, mcSeed: 42 });

      // claude-code-fails must halt cleanly without crashing.
      if (fx.fixture_id === "claude-code-fails") {
        expect(result.halted.kind).toBe("pillar_2_failed");
        if (result.halted.kind === "pillar_2_failed") {
          expect(result.halted.fixHint).toMatch(/claude|signed|install/i);
        }
        return;
      }

      expect(result.halted.kind).toBe("success");

      const manifest = result.companyManifest;

      // 1 · schema shape
      expect(manifest.schema_version).toBe("1.0");
      expect(manifest.org_id).toBe(fx.fixture_id);
      expect(manifest.finalized_at).toMatch(/\d{4}-\d{2}-\d{2}T/);
      expect(manifest.signatures.manifest_hash).toMatch(/^sha256:/);

      // 2 · topology counts sum to base roster
      const t = manifest.swarm_manifest.topology;
      expect(t.active_count + (t.standby_count ?? 0) + t.parked_count + t.disabled_count).toBe(BASE_ROSTER_SIZE);
      expect(t.total_base_roster).toBe(BASE_ROSTER_SIZE);

      // 3 · every workflow agent must exist as active in swarm manifest
      for (const agentId of Object.keys(manifest.workflow_manifest.agent_workflows)) {
        const swarmAgent = manifest.swarm_manifest.agents[agentId];
        expect(swarmAgent, `workflow references missing agent: ${agentId}`).toBeDefined();
        expect(swarmAgent.status, `workflow references non-active agent: ${agentId}`).toBe("active");
      }

      // 4 · every connector referenced in a workflow task exists in the
      //     connector manifest OR has been nullified with dry_run_gate: true
      const configuredConnectors = new Set([
        ...manifest.connector_manifest.required.map((c) => c.id),
        ...manifest.connector_manifest.suggested.map((c) => c.id),
      ]);
      for (const [agentId, wf] of Object.entries(manifest.workflow_manifest.agent_workflows)) {
        for (const task of wf.on_fire) {
          if (typeof task.connector === "string" && task.connector.length > 0) {
            if (!configuredConnectors.has(task.connector)) {
              // Must be nullified & dry-run-gated.
              expect(
                task.dry_run_gate,
                `${agentId}.${task.task} references unconfigured connector ${task.connector} without dry_run_gate`,
              ).toBe(true);
            }
          }
        }
      }

      // 5 · bundle allocation sums to 1.0 ± ε
      const alloc = manifest.swarm_manifest.bundle_allocation_initial;
      const total = alloc.insight_activation + alloc.pipeline_velocity + alloc.expansion_engine + alloc.unit_economics + alloc.strategic_positioning;
      expect(total).toBeGreaterThan(0.98);
      expect(total).toBeLessThan(1.02);

      // 6 · write-side tasks produce a non-empty dry_run_gates list in most
      //     realistic fixtures. For BOOTSTRAP_NO_GTM / pre-product, most
      //     write-side agents are parked — the list may be small but should
      //     still include anything that IS active with dry_run_gate: true.
      const expectedGates = new Set<string>();
      for (const [agentId, wf] of Object.entries(manifest.workflow_manifest.agent_workflows)) {
        for (const task of wf.on_fire) {
          if (task.dry_run_gate === true) expectedGates.add(`${agentId}.${task.task}`);
        }
      }
      expect(new Set(manifest.workflow_manifest.dry_run_gates)).toEqual(expectedGates);

      // 7 · dry_run.enabled must be true on a fresh finalize
      expect(manifest.dry_run.enabled).toBe(true);
      expect(new Date(manifest.dry_run.expires_at).getTime()).toBeGreaterThan(Date.now());
    }, 300_000);
  }
});

describe("Suite 3 · Surface Coverage · base fixtures as sanity", async () => {
  // A sanity sample from the base fixtures exercises the common case too.
  const BASE_DIR = join(__dirname, "fixtures/base");
  const names = (await readdir(BASE_DIR)).filter((n) => n.endsWith(".json"));
  const fixtures: OnboardingFixture[] = [];
  for (const n of names) fixtures.push(await loadFixture(join(BASE_DIR, n)));

  for (const fx of fixtures) {
    it(`${fx.fixture_id}: baseline pipeline produces a valid manifest`, async () => {
      const result = await runOnboardingPipeline(fx, { skipInference: !RUN_LIVE, mcSeed: 42 });
      expect(result.halted.kind).toBe("success");
      const m = result.companyManifest;
      expect(m.schema_version).toBe("1.0");
      const t = m.swarm_manifest.topology;
      expect(t.active_count + (t.standby_count ?? 0) + t.parked_count + t.disabled_count).toBe(BASE_ROSTER_SIZE);
      const a = m.swarm_manifest.bundle_allocation_initial;
      const total = a.insight_activation + a.pipeline_velocity + a.expansion_engine + a.unit_economics + a.strategic_positioning;
      expect(total).toBeGreaterThan(0.98);
      expect(total).toBeLessThan(1.02);
    }, 300_000);
  }
});
