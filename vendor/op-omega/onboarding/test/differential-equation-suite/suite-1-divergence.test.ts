/**
 * OPΩ-ONB-TEST-001-rev2 · Suite 1 · Divergence · Signal Propagation
 *
 * Hypothesis: two operators differing on one pillar answer produce manifests
 * whose diff on structural fields exceeds a threshold proportional to the
 * pillar's downstream influence.
 *
 * Thresholds (Appendix §2):
 *   Pillar 1 (has_product):  ≥ 2 connectors · ≥ 3 agents · ≥ 0.15 L1
 *   Pillar 3 (stage):        ≥ 1 connector  · ≥ 2 agents · ≥ 0.10 L1
 *   Pillar 4 (gtm):          ≥ 1 connector  · ≥ 2 agents (+S+) · ≥ 0.15 L1
 *   Pillar 5 (comms):        ≥ 1 connector  · 0 agents · 0 L1  (channel-swap only)
 *
 * Defaults to `skipInference: true` for iterative speed. Set
 * `OP_OMEGA_TEST_LIVE=1` to run against live T2 (the full data-gen mode).
 */

import { describe, expect, it, beforeAll } from "vitest";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { loadFixture, runOnboardingPipeline, type OnboardingFixture } from "./harness/run-onboarding-pipeline.js";
import { computeManifestDiff, summarizeDiffMagnitude } from "./harness/compute-manifest-diff.js";
import { generateVariants, type Variant, type PillarToVary } from "./harness/fixture-variant-generator.js";
import { detectAnomalies, inputSignature, writeQARecord } from "./qa/qa-record-writer.js";
import { randomUUID } from "node:crypto";

const BASE_DIR = join(__dirname, "fixtures/base");
const RUN_LIVE = process.env.OP_OMEGA_TEST_LIVE === "1";
const MC_SEED = 42;

interface PillarThreshold {
  connector_min: number;
  agent_status_min: number;
  allocation_l1_min: number;
}

const THRESHOLDS: Record<PillarToVary, PillarThreshold> = {
  1: { connector_min: 2, agent_status_min: 3, allocation_l1_min: 0.15 },
  3: { connector_min: 1, agent_status_min: 2, allocation_l1_min: 0.10 },
  4: { connector_min: 1, agent_status_min: 2, allocation_l1_min: 0.15 },
  5: { connector_min: 1, agent_status_min: 0, allocation_l1_min: 0.0 },
};

async function listBaseFixtures(): Promise<OnboardingFixture[]> {
  const names = await readdir(BASE_DIR);
  const fixtures: OnboardingFixture[] = [];
  for (const n of names) {
    if (!n.endsWith(".json")) continue;
    fixtures.push(await loadFixture(join(BASE_DIR, n)));
  }
  return fixtures;
}

// Per spec §G this suite runs against live T2. In skipInference mode the
// decision-matrix-only diffs are usually below the live-T2-calibrated
// thresholds, so we gate on OP_OMEGA_TEST_LIVE=1.
describe.skipIf(!RUN_LIVE)("Suite 1 · Divergence · pillar signal propagates into manifests", async () => {
  const bases = await listBaseFixtures();

  for (const base of bases) {
    describe(`base: ${base.fixture_id}`, () => {
      let baseResult: Awaited<ReturnType<typeof runOnboardingPipeline>> | null = null;
      let variants: Variant[] = [];

      beforeAll(async () => {
        baseResult = await runOnboardingPipeline(base, { skipInference: !RUN_LIVE, mcSeed: MC_SEED });
        variants = generateVariants(base);
      }, 600_000);

      it(`base runs cleanly`, () => {
        expect(baseResult?.halted.kind).toBe("success");
      });

      for (const pillar of [1, 3, 4, 5] as PillarToVary[]) {
        const pillarVariants = () => variants.filter((v) => v.pillar_varied === pillar);

        it(`pillar ${pillar} variants produce diffs above threshold`, async () => {
          if (!baseResult || baseResult.halted.kind !== "success") throw new Error("base run didn't succeed");

          const threshold = THRESHOLDS[pillar];
          const failures: string[] = [];

          for (const v of pillarVariants()) {
            const vr = await runOnboardingPipeline(v.variant, { skipInference: !RUN_LIVE, mcSeed: MC_SEED });
            expect(vr.halted.kind, `variant ${v.variant.fixture_id} halted unexpectedly`).toBe("success");

            const diff = computeManifestDiff(
              { connectorManifest: baseResult.connectorManifest, swarmManifest: baseResult.swarmManifest, workflowManifest: baseResult.workflowManifest },
              { connectorManifest: vr.connectorManifest, swarmManifest: vr.swarmManifest, workflowManifest: vr.workflowManifest },
            );
            const mag = summarizeDiffMagnitude(diff);

            // Persist QA record.
            await writeQARecord({
              fixture_id: v.variant.fixture_id,
              run_id: randomUUID(),
              timestamp: new Date().toISOString(),
              input_signature: inputSignature(vr.pillarResponses),
              manifest_hash: vr.companyManifest.signatures?.manifest_hash ?? "",
              diff_from_baseline: diff,
              suite_results: {
                divergence:
                  mag.connector_count >= threshold.connector_min &&
                  mag.agent_status_count >= threshold.agent_status_min &&
                  mag.allocation_l1 >= threshold.allocation_l1_min,
              },
              anomaly_flags: detectAnomalies({
                diff,
                t2CallCount: vr.t2CallCount,
                halted: false,
                expectedDiff: { connector_min: threshold.connector_min, agent_status_min: threshold.agent_status_min, allocation_l1_min: threshold.allocation_l1_min },
              }),
              t2_call_count: vr.t2CallCount,
              t2_cost_estimate: 0,
              timings: vr.timings,
              notes: `variant of ${base.fixture_id} via p${pillar}=${v.alternative_key}`,
            });

            // Note: Pillar 5 is the tricky one — channel swap may produce 0 agent-status changes legitimately.
            if (mag.connector_count < threshold.connector_min) {
              failures.push(`${v.variant.fixture_id}: connector diff ${mag.connector_count} < ${threshold.connector_min}`);
            }
            if (mag.agent_status_count < threshold.agent_status_min) {
              failures.push(`${v.variant.fixture_id}: agent-status diff ${mag.agent_status_count} < ${threshold.agent_status_min}`);
            }
            if (mag.allocation_l1 < threshold.allocation_l1_min) {
              failures.push(`${v.variant.fixture_id}: allocation L1 ${mag.allocation_l1.toFixed(3)} < ${threshold.allocation_l1_min}`);
            }
          }

          expect(failures, `pillar ${pillar} divergence below threshold:\n${failures.join("\n")}`).toEqual([]);
        }, 1_800_000);
      }
    });
  }
});

/**
 * OPΩ-ONB-UNIFIED-001 · NEW-C3.2 · Stage-clustering assertion.
 *
 * Surface divergence alone is ambiguous — it could be random noise.
 * The L2 region-quality claim is that manifests *cluster by stage*:
 * intra-stage mean L1 on bundle_allocation < inter-stage mean L1, by
 * a margin reflecting `phase3.industry_delta` + `phase3.clamp_bounds`
 * calibration. This runs mock-mode against the existing validation-
 * matrix fixtures; no live T2 required.
 */
const VM_DIR = join(__dirname, "fixtures/validation-matrix");

interface StageRun {
  fixture_id: string;
  stage: string;
  bundle_allocation: number[];
}

function l1Vec(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - (b[i] ?? 0));
  return s;
}

describe("Suite 1 · NEW-C3.2 · stage-cluster structure (mock mode)", async () => {
  const names = await readdir(VM_DIR);
  const fixtures = await Promise.all(
    names.filter((n) => n.endsWith(".json")).map((n) => loadFixture(join(VM_DIR, n))),
  );

  let runs: StageRun[] = [];

  beforeAll(async () => {
    // Sequential, not Promise.all — the harness mutates process.env.PAPERCLIP_DATA_DIR
    // and concurrent runs race on that env var.
    const out: StageRun[] = [];
    for (const f of fixtures) {
      const r = await runOnboardingPipeline(f, { skipInference: true, mcSeed: MC_SEED });
      const alloc = r.swarmManifest.bundle_allocation_initial;
      out.push({
        fixture_id: f.fixture_id,
        stage: String(f.pillar_3?.stage ?? "unknown"),
        bundle_allocation: [
          alloc.insight_activation,
          alloc.pipeline_velocity,
          alloc.expansion_engine,
          alloc.unit_economics,
          alloc.strategic_positioning,
        ],
      });
    }
    runs = out;
  }, 240_000);

  /**
   * Strict assertion: intra-stage L1 on bundle_allocation is smaller than
   * inter-stage L1 by at least MARGIN. Proves manifests cluster by stage,
   * so "divergence" reflects structure (stage) not noise (random).
   */
  it("intra-stage L1 < inter-stage L1 by ≥ margin", () => {
    const byStage = new Map<string, StageRun[]>();
    for (const r of runs) {
      const arr = byStage.get(r.stage) ?? [];
      arr.push(r);
      byStage.set(r.stage, arr);
    }

    const multiFixtureStages = [...byStage.entries()].filter(([, rs]) => rs.length >= 2);
    expect(multiFixtureStages.length, "need ≥1 stage with ≥2 fixtures").toBeGreaterThan(0);

    const intraDistances: number[] = [];
    for (const [, rs] of multiFixtureStages) {
      for (let i = 0; i < rs.length; i++) {
        for (let j = i + 1; j < rs.length; j++) {
          intraDistances.push(l1Vec(rs[i].bundle_allocation, rs[j].bundle_allocation));
        }
      }
    }

    const interDistances: number[] = [];
    const stageList = [...byStage.keys()];
    for (let i = 0; i < stageList.length; i++) {
      for (let j = i + 1; j < stageList.length; j++) {
        const left = byStage.get(stageList[i])!;
        const right = byStage.get(stageList[j])!;
        for (const a of left) {
          for (const b of right) {
            interDistances.push(l1Vec(a.bundle_allocation, b.bundle_allocation));
          }
        }
      }
    }

    const meanIntra = intraDistances.reduce((a, b) => a + b, 0) / intraDistances.length;
    const meanInter = interDistances.reduce((a, b) => a + b, 0) / interDistances.length;
    const MARGIN = 0.05;

    // eslint-disable-next-line no-console
    console.log(
      `[NEW-C3.2] stage clustering — intra=${meanIntra.toFixed(4)} inter=${meanInter.toFixed(4)} ratio=${(meanIntra / meanInter).toFixed(3)}`,
    );

    const report = [
      `stages with ≥2 fixtures: ${multiFixtureStages.map(([s, rs]) => `${s}(${rs.length})`).join(", ")}`,
      `mean intra-stage L1: ${meanIntra.toFixed(4)} (n=${intraDistances.length})`,
      `mean inter-stage L1: ${meanInter.toFixed(4)} (n=${interDistances.length})`,
      `margin required: ${MARGIN}`,
    ].join("\n");

    expect(
      meanIntra + MARGIN < meanInter,
      `stage clustering too weak — manifests don't diverge by stage:\n${report}`,
    ).toBe(true);
  }, 180_000);
});
