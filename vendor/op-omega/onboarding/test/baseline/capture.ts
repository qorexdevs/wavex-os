#!/usr/bin/env node
/**
 * OPΩ-ONB-UNIFIED-001 · §B baseline capture.
 *
 * Runs a small representative fixture set through the mock pipeline and
 * emits fixture-measurable KPIs (K1, K5, K6, K7 partial) to JSON. K2 is
 * read from the most recent live-run report if available. K3 + K4 are
 * runtime telemetry — emitted as null with a note.
 *
 * Usage: pnpm baseline:capture [--out path] [--fixtures a,b,c]
 */

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadFixture,
  runOnboardingPipeline,
  type PipelineRunResult,
} from "../differential-equation-suite/harness/run-onboarding-pipeline.js";

type Num = number | null;

interface BaselineKPIs {
  k1_manifest_divergence: Num;
  k2_verdict: string | null;
  k3_pillar_completion_rate: Num;
  k4_operator_correction_rate: Num;
  k5_avg_t2_calls: Num;
  k5_max_t2_calls: Num;
  k6_mc_projection_mean: Record<string, number> | null;
  k7_inference_value_gap: Num;
}

interface BaselineReport {
  generated_at: string;
  fixtures: string[];
  kpis: BaselineKPIs;
  per_fixture: Array<{
    fixture_id: string;
    t2_calls: number;
    halted: boolean;
    bundle_allocation: number[];
    active_agent_count: number;
    connectors_required_count: number;
    mc_strategy: string;
    mc_mean_mrr_growth: number;
    mc_p_ruin: number;
  }>;
  notes: string[];
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const inter = [...a].filter((x) => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 1 : inter / union;
}

function l1(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - (b[i] ?? 0));
  return s;
}

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

/**
 * K1 · composite manifest-divergence score.
 *
 *   K1 = mean over all pairs of [0.5 × (1 - activeAgentJaccard)
 *                              + 0.3 × bundleAllocationL1
 *                              + 0.2 × (1 - connectorJaccard)]
 *
 * Range ~0..1. Target ≥ 0.45 per prompt §B.
 */
function computeK1(runs: PipelineRunResult[]): number {
  const pairs: number[] = [];
  for (let i = 0; i < runs.length; i++) {
    for (let j = i + 1; j < runs.length; j++) {
      const a = runs[i];
      const b = runs[j];
      const aAgents = new Set(
        Object.entries(a.swarmManifest.agents)
          .filter(([, x]) => x.status === "active")
          .map(([id]) => id),
      );
      const bAgents = new Set(
        Object.entries(b.swarmManifest.agents)
          .filter(([, x]) => x.status === "active")
          .map(([id]) => id),
      );
      const aConn = new Set(a.connectorManifest.required.map((e) => e.id));
      const bConn = new Set(b.connectorManifest.required.map((e) => e.id));
      const aAlloc = [
        a.swarmManifest.bundle_allocation_initial.insight_activation,
        a.swarmManifest.bundle_allocation_initial.pipeline_velocity,
        a.swarmManifest.bundle_allocation_initial.expansion_engine,
        a.swarmManifest.bundle_allocation_initial.unit_economics,
        a.swarmManifest.bundle_allocation_initial.strategic_positioning,
      ];
      const bAlloc = [
        b.swarmManifest.bundle_allocation_initial.insight_activation,
        b.swarmManifest.bundle_allocation_initial.pipeline_velocity,
        b.swarmManifest.bundle_allocation_initial.expansion_engine,
        b.swarmManifest.bundle_allocation_initial.unit_economics,
        b.swarmManifest.bundle_allocation_initial.strategic_positioning,
      ];
      const score =
        0.5 * (1 - jaccard(aAgents, bAgents)) +
        0.3 * l1(aAlloc, bAlloc) +
        0.2 * (1 - jaccard(aConn, bConn));
      pairs.push(score);
    }
  }
  return pairs.length === 0 ? 0 : mean(pairs);
}

/** Read the most recent live-run report and extract its verdict. */
async function readLastVerdict(suiteReportDir: string): Promise<string | null> {
  try {
    const files = (await readdir(suiteReportDir))
      .filter((f) => f.startsWith("last-run-") && f.endsWith(".md"))
      .sort();
    if (files.length === 0) return null;
    const latest = files[files.length - 1];
    const body = await readFile(join(suiteReportDir, latest), "utf8");
    const m = body.match(/VERDICT:\s*([A-Z_]+)/) ?? body.match(/\*\*Verdict:\*\*\s*`?([A-Z_]+)`?/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const outFlag = args.indexOf("--out");
  const fixFlag = args.indexOf("--fixtures");
  const outPathArg = outFlag >= 0 ? args[outFlag + 1] : null;
  const fixList = fixFlag >= 0 ? args[fixFlag + 1]!.split(",") : [
    "pre-product-solo",
    "mega-enterprise",
    "contradictory",
    "acme-plg-startup",
  ];

  const here = dirname(fileURLToPath(import.meta.url));
  // packages/plugins/onboarding/src/baseline/ → up 3 to package root
  const pluginRoot = resolve(here, "..", "..");
  const fixturesRoot = join(pluginRoot, "test", "differential-equation-suite", "fixtures");
  const reportDir = join(pluginRoot, "test", "differential-equation-suite", "report");
  // packages/plugins/onboarding/ → up 3 to repo root
  const repoRoot = resolve(pluginRoot, "..", "..", "..");

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const defaultOut = join(repoRoot, "baseline", `pre-sprint-${today}.json`);
  const outPath = outPathArg ? resolve(process.cwd(), outPathArg) : defaultOut;

  console.log(`[baseline] fixtures: ${fixList.join(", ")}`);
  console.log(`[baseline] output  : ${outPath}`);

  const runs: PipelineRunResult[] = [];
  const perFixture: BaselineReport["per_fixture"] = [];
  const notes: string[] = [];

  for (const name of fixList) {
    const candidates = [
      join(fixturesRoot, "edge-cases", `${name}.json`),
      join(fixturesRoot, "base", `${name}.json`),
      join(fixturesRoot, "validation-matrix", `${name}.json`),
    ];
    let path: string | null = null;
    for (const p of candidates) {
      try {
        await readFile(p, "utf8");
        path = p;
        break;
      } catch {
        // continue
      }
    }
    if (!path) {
      notes.push(`fixture not found: ${name}`);
      console.warn(`[baseline] MISSING fixture: ${name}`);
      continue;
    }
    console.log(`[baseline] running ${name}...`);
    const fixture = await loadFixture(path);
    const result = await runOnboardingPipeline(fixture, { skipInference: true });
    runs.push(result);

    const activeCount = Object.values(result.swarmManifest.agents).filter(
      (a) => a.status === "active",
    ).length;
    perFixture.push({
      fixture_id: result.fixture_id,
      t2_calls: result.t2CallCount,
      halted: result.halted.kind !== "success",
      bundle_allocation: [
        result.swarmManifest.bundle_allocation_initial.insight_activation,
        result.swarmManifest.bundle_allocation_initial.pipeline_velocity,
        result.swarmManifest.bundle_allocation_initial.expansion_engine,
        result.swarmManifest.bundle_allocation_initial.unit_economics,
        result.swarmManifest.bundle_allocation_initial.strategic_positioning,
      ],
      active_agent_count: activeCount,
      connectors_required_count: result.connectorManifest.required.length,
      mc_strategy: result.companyManifest.mc_winner.strategy_id,
      mc_mean_mrr_growth: result.companyManifest.mc_winner.mean_mrr_growth,
      mc_p_ruin: result.companyManifest.mc_winner.p_ruin,
    });
  }

  const k1 = computeK1(runs);
  const k2 = await readLastVerdict(reportDir);
  const t2Counts = runs.map((r) => r.t2CallCount);
  const mcProj =
    runs.length === 0
      ? null
      : {
          mean_mrr_growth: mean(runs.map((r) => r.companyManifest.mc_winner.mean_mrr_growth)),
          p_ruin: mean(runs.map((r) => r.companyManifest.mc_winner.p_ruin)),
          sharpe: mean(runs.map((r) => r.companyManifest.mc_winner.sharpe)),
        };

  const report: BaselineReport = {
    generated_at: new Date().toISOString(),
    fixtures: runs.map((r) => r.fixture_id),
    kpis: {
      k1_manifest_divergence: Number(k1.toFixed(4)),
      k2_verdict: k2,
      k3_pillar_completion_rate: null,
      k4_operator_correction_rate: null,
      k5_avg_t2_calls: t2Counts.length === 0 ? null : Number(mean(t2Counts).toFixed(2)),
      k5_max_t2_calls: t2Counts.length === 0 ? null : Math.max(...t2Counts),
      k6_mc_projection_mean: mcProj,
      k7_inference_value_gap: null,
    },
    per_fixture: perFixture,
    notes: [
      ...notes,
      "K3 (pillar completion rate) requires runtime telemetry; not computable from fixture runs.",
      "K4 (operator correction rate on KPI estimates) requires runtime telemetry; not computable from fixture runs.",
      "K7 (inference value gap) would require a Suite 4 paired live vs mock run; marked null for mock-only capture.",
      "K5 measured via mock pipeline; true per-run T2 cost is measured only in a live run.",
    ],
  };

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`[baseline] wrote ${outPath}`);
  console.log(`[baseline] K1=${report.kpis.k1_manifest_divergence} K2=${report.kpis.k2_verdict ?? "unknown"} K5_avg=${report.kpis.k5_avg_t2_calls} K5_max=${report.kpis.k5_max_t2_calls}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
