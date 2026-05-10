/**
 * OPΩ-ONB-SPRINT-002 · Issue 6 · Validation-matrix runner (extended Sprint 2b).
 *
 * Runs 10 validation-matrix fixtures through the pipeline and measures
 * divergence across 8 axes per fixture pair. A pair counts as a **curve**
 * only if it's flat on ≥ 5 axes; otherwise it's a **surface**.
 *
 *   Axis 1 · Active-agent set (Jaccard)
 *   Axis 2 · Skill-overlay token set (Jaccard)
 *   Axis 3 · Workflow on_fire task names (Jaccard averaged per shared agent)
 *   Axis 4 · Bundle allocation (L1 distance)
 *   Axis 5 · Connector set (Jaccard)
 *   Axis 6 · Dry-run gates (Jaccard)
 *   Axis 7 · MC strategy winner (binary)
 *   Axis 8 · MC projection vector (L2 on [mean_mrr_growth, p_ruin, sharpe])
 *
 * Runs with `pnpm test:validation-matrix`. Use `--live` to include T2.
 */

import { readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runOnboardingPipeline, type OnboardingFixture, loadFixture } from "../harness/run-onboarding-pipeline.js";
import { selectMCModel } from "@op-omega/plugin-flywheel-kernel";

interface FixtureRun {
  id: string;
  expected: Record<string, unknown>;
  active_agents: Set<string>;
  standby_agents: Set<string>;
  parked_agents: Set<string>;
  disabled_agents: Set<string>;
  connectors_required: Set<string>;
  connectors_suggested: Set<string>;
  /** Tokens extracted from every active agent's skill_overlay. */
  skill_overlay_tokens: Set<string>;
  /** agent_id → on_fire task name set. */
  workflow_tasks: Record<string, Set<string>>;
  /** 5-value allocation weights vector. */
  bundle_allocation: number[];
  /** Set of dry-run gate strings. */
  dry_run_gates: Set<string>;
  mc_strategy: string;
  mc_mode: string;
  mc_projection: { mean_mrr_growth: number; p_ruin: number; sharpe: number };
  t2_patches_signal_distinct: number;
  halted: boolean;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const inter = [...a].filter((x) => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return inter / union;
}

function l1(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s;
}

function l2(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return Math.sqrt(s);
}

const STOP_WORDS = new Set([
  "the","a","an","of","and","or","but","for","to","in","on","at","by","with","is","are","was","were","be","been",
  "this","that","these","those","it","its","has","have","had","will","would","can","could","up","down","weight",
  "active","parked","disabled","per","from","not","no","yes","so","as","if","than","then","when","where","which",
]);

function tokenize(s: string | null | undefined): Set<string> {
  if (!s) return new Set();
  const out = new Set<string>();
  for (const raw of s.split(/[\s,.()\-_/:]+/)) {
    const t = raw.toLowerCase().trim();
    if (t.length < 3) continue;
    if (STOP_WORDS.has(t)) continue;
    if (!/[a-z]/.test(t)) continue;
    out.add(t);
  }
  return out;
}

function pad(s: string | number, n: number): string {
  return String(s).padEnd(n);
}
function rp(s: string | number, n: number): string {
  return String(s).padStart(n);
}

async function runFixture(path: string, live: boolean): Promise<FixtureRun> {
  const fixture = (await loadFixture(path)) as OnboardingFixture & { expected?: Record<string, unknown> };
  const result = await runOnboardingPipeline(fixture, { skipInference: !live });
  const expected = (fixture.expected as Record<string, unknown>) ?? {};

  if (result.halted.kind !== "success") {
    return {
      id: fixture.fixture_id,
      expected,
      active_agents: new Set(),
      standby_agents: new Set(),
      parked_agents: new Set(),
      disabled_agents: new Set(),
      connectors_required: new Set(),
      connectors_suggested: new Set(),
      skill_overlay_tokens: new Set(),
      workflow_tasks: {},
      bundle_allocation: [0.2, 0.2, 0.2, 0.2, 0.2],
      dry_run_gates: new Set(),
      mc_strategy: "HALTED",
      mc_mode: "halted",
      mc_projection: { mean_mrr_growth: 0, p_ruin: 0, sharpe: 0 },
      t2_patches_signal_distinct: 0,
      halted: true,
    };
  }

  const agents = result.swarmManifest.agents;
  const active = new Set<string>();
  const standby = new Set<string>();
  const parked = new Set<string>();
  const disabled = new Set<string>();
  const overlayTokens = new Set<string>();
  for (const [id, a] of Object.entries(agents)) {
    if (a.status === "active") active.add(id);
    else if (a.status === "standby") standby.add(id);
    else if (a.status === "parked") parked.add(id);
    else disabled.add(id);
    // Collect tokens from overlay of active agents only — parked/disabled
    // overlays are noise since the agent isn't running.
    if (a.status === "active" && a.skill_overlay) {
      for (const t of tokenize(a.skill_overlay)) overlayTokens.add(t);
    }
  }

  const workflowTasks: Record<string, Set<string>> = {};
  for (const [id, wf] of Object.entries(result.workflowManifest.agent_workflows)) {
    workflowTasks[id] = new Set(wf.on_fire.map((t) => t.task));
  }

  const req = new Set(result.connectorManifest.required.map((e) => e.id));
  const sug = new Set(result.connectorManifest.suggested.map((e) => e.id));
  const allocObj = result.swarmManifest.bundle_allocation_initial;
  const alloc = [
    allocObj.insight_activation,
    allocObj.pipeline_velocity,
    allocObj.expansion_engine,
    allocObj.unit_economics,
    allocObj.strategic_positioning,
  ];
  const dryGates = new Set(result.workflowManifest.dry_run_gates);
  const mcWinner = result.companyManifest.mc_winner;
  const mcMode = selectMCModel(fixture.pillar_3?.stage);
  const patches = result.workflowManifest.t2_patches ?? [];
  const signalsCited = new Set(patches.map((p) => p.pillar_signal.split("=")[0]));

  return {
    id: fixture.fixture_id,
    expected,
    active_agents: active,
    standby_agents: standby,
    parked_agents: parked,
    disabled_agents: disabled,
    connectors_required: req,
    connectors_suggested: sug,
    skill_overlay_tokens: overlayTokens,
    workflow_tasks: workflowTasks,
    bundle_allocation: alloc,
    dry_run_gates: dryGates,
    mc_strategy: mcWinner.strategy_id,
    mc_mode: mcMode,
    mc_projection: {
      mean_mrr_growth: mcWinner.mean_mrr_growth,
      p_ruin: mcWinner.p_ruin,
      sharpe: mcWinner.sharpe,
    },
    t2_patches_signal_distinct: signalsCited.size,
    halted: false,
  };
}

/**
 * Compute Jaccard per shared agent's workflow task set, average across the
 * shared agents. A pair with no shared agents is 0 (fully divergent).
 */
function workflowTaskJaccard(a: FixtureRun, b: FixtureRun): number {
  const shared = Object.keys(a.workflow_tasks).filter((id) => id in b.workflow_tasks);
  if (shared.length === 0) return 0;
  let sum = 0;
  for (const id of shared) {
    sum += jaccard(a.workflow_tasks[id], b.workflow_tasks[id]);
  }
  return sum / shared.length;
}

interface PairScore {
  a_id: string;
  b_id: string;
  axis1_active_jaccard: number;
  axis2_overlay_jaccard: number;
  axis3_workflow_task_jaccard: number;
  axis4_alloc_l1: number;
  axis5_connector_jaccard: number;
  axis6_drygate_jaccard: number;
  axis7_strategy_same: boolean;
  axis8_mc_l2: number;
  /** How many axes show "flat" (similar) behavior. Pair is curve if >= 5. */
  flat_axis_count: number;
  verdict: "surface" | "borderline" | "curve";
}

/**
 * Thresholds tuned against the deterministic baseline. "Flat" means the pair
 * is indistinguishable on that axis.
 *
 *   axis1 active Jaccard  > 0.90  flat
 *   axis2 overlay Jaccard > 0.80  flat   (token overlap allowed — small N)
 *   axis3 workflow tasks  > 0.85  flat
 *   axis4 alloc L1        < 0.05  flat   (weights barely moved)
 *   axis5 connector       > 0.85  flat
 *   axis6 dry-run gates   > 0.85  flat
 *   axis7 strategy winner == true flat
 *   axis8 MC L2           < 0.10  flat   (projection vector barely moved)
 */
const FLAT = {
  axis1: 0.9,
  axis2: 0.8,
  axis3: 0.85,
  axis4: 0.05,
  axis5: 0.85,
  axis6: 0.85,
  axis8: 0.1,
};

function scorePair(a: FixtureRun, b: FixtureRun): PairScore {
  const allConn = (r: FixtureRun) => new Set([...r.connectors_required, ...r.connectors_suggested]);
  const axis1 = jaccard(a.active_agents, b.active_agents);
  const axis2 = jaccard(a.skill_overlay_tokens, b.skill_overlay_tokens);
  const axis3 = workflowTaskJaccard(a, b);
  const axis4 = l1(a.bundle_allocation, b.bundle_allocation);
  const axis5 = jaccard(allConn(a), allConn(b));
  const axis6 = jaccard(a.dry_run_gates, b.dry_run_gates);
  const axis7 = a.mc_strategy === b.mc_strategy;
  const axis8 = l2(
    [a.mc_projection.mean_mrr_growth, a.mc_projection.p_ruin, a.mc_projection.sharpe],
    [b.mc_projection.mean_mrr_growth, b.mc_projection.p_ruin, b.mc_projection.sharpe],
  );
  let flat = 0;
  if (axis1 > FLAT.axis1) flat += 1;
  if (axis2 > FLAT.axis2) flat += 1;
  if (axis3 > FLAT.axis3) flat += 1;
  if (axis4 < FLAT.axis4) flat += 1;
  if (axis5 > FLAT.axis5) flat += 1;
  if (axis6 > FLAT.axis6) flat += 1;
  if (axis7) flat += 1;
  if (axis8 < FLAT.axis8) flat += 1;
  const verdict: PairScore["verdict"] = flat >= 5 ? "curve" : flat >= 3 ? "borderline" : "surface";
  return {
    a_id: a.id,
    b_id: b.id,
    axis1_active_jaccard: axis1,
    axis2_overlay_jaccard: axis2,
    axis3_workflow_task_jaccard: axis3,
    axis4_alloc_l1: axis4,
    axis5_connector_jaccard: axis5,
    axis6_drygate_jaccard: axis6,
    axis7_strategy_same: axis7,
    axis8_mc_l2: axis8,
    flat_axis_count: flat,
    verdict,
  };
}

async function main(): Promise<void> {
  const live = process.argv.includes("--live");
  if (!process.env.OP_OMEGA_PAPERCLIP_BASE_URL) {
    process.env.OP_OMEGA_PAPERCLIP_BASE_URL = "http://127.0.0.1:3101";
  }
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const fixturesDir = join(__dirname, "..", "fixtures", "validation-matrix");
  const files = (await readdir(fixturesDir)).filter((f) => f.endsWith(".json")).sort();

  console.log(`# Validation Matrix Report · ${live ? "LIVE" : "deterministic baseline"}`);
  console.log(`# Fixtures: ${files.length}`);
  console.log();

  const runs: FixtureRun[] = [];
  for (const f of files) {
    const path = join(fixturesDir, f);
    try {
      const r = await runFixture(path, live);
      runs.push(r);
    } catch (err) {
      console.error(`✗ ${f} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Table 0 — per-fixture topology
  console.log("## Table 0 · Per-fixture topology + MC output");
  console.log();
  console.log(
    `| ${pad("Fixture", 40)} | ${rp("active", 6)} | ${rp("standby", 7)} | ${rp("parked", 6)} | ${rp("disabled", 8)} | ${rp("conn", 4)} | ${pad("MC strategy", 20)} | ${rp("MRR%", 6)} | ${rp("pRuin", 5)} | ${rp("Sharpe", 6)} |`,
  );
  console.log(
    `|${"-".repeat(42)}|${"-".repeat(8)}|${"-".repeat(9)}|${"-".repeat(8)}|${"-".repeat(10)}|${"-".repeat(6)}|${"-".repeat(22)}|${"-".repeat(8)}|${"-".repeat(7)}|${"-".repeat(8)}|`,
  );
  for (const r of runs) {
    const connCount = r.connectors_required.size + r.connectors_suggested.size;
    const mrrPct = `${(r.mc_projection.mean_mrr_growth * 100).toFixed(0)}%`;
    const pRuin = r.mc_projection.p_ruin.toFixed(2);
    const sharpe = r.mc_projection.sharpe.toFixed(2);
    console.log(
      `| ${pad(r.id, 40)} | ${rp(r.active_agents.size, 6)} | ${rp(r.standby_agents.size, 7)} | ${rp(r.parked_agents.size, 6)} | ${rp(r.disabled_agents.size, 8)} | ${rp(connCount, 4)} | ${pad(r.mc_strategy, 20)} | ${rp(mrrPct, 6)} | ${rp(pRuin, 5)} | ${rp(sharpe, 6)} |`,
    );
  }
  console.log();

  // Table 1 — per-pair multi-axis scorecard
  console.log("## Table 1 · Per-pair 8-axis divergence scorecard");
  console.log();
  console.log(`Each axis is flagged **flat** if the pair is indistinguishable on that dimension.`);
  console.log(`A pair counts as a **curve** if ≥ 5 axes are flat. **Borderline** if 3–4. **Surface** if ≤ 2.`);
  console.log();
  console.log(`- axis1: active-agent set Jaccard (>${FLAT.axis1} = flat)`);
  console.log(`- axis2: skill-overlay token Jaccard (>${FLAT.axis2} = flat)`);
  console.log(`- axis3: workflow on_fire task Jaccard (>${FLAT.axis3} = flat)`);
  console.log(`- axis4: bundle allocation L1 distance (<${FLAT.axis4} = flat)`);
  console.log(`- axis5: connector set Jaccard (>${FLAT.axis5} = flat)`);
  console.log(`- axis6: dry-run gates Jaccard (>${FLAT.axis6} = flat)`);
  console.log(`- axis7: MC strategy winner same (same = flat)`);
  console.log(`- axis8: MC projection vector L2 (<${FLAT.axis8} = flat)`);
  console.log();
  console.log(
    `| ${pad("Pair", 52)} | ${rp("act", 4)} | ${rp("ovr", 4)} | ${rp("wf", 4)} | ${rp("aL1", 4)} | ${rp("con", 4)} | ${rp("dry", 4)} | ${rp("mc=", 4)} | ${rp("mcL2", 4)} | ${rp("flat", 4)} | ${pad("verdict", 11)} |`,
  );
  console.log(
    `|${"-".repeat(54)}|${"-".repeat(6)}|${"-".repeat(6)}|${"-".repeat(6)}|${"-".repeat(6)}|${"-".repeat(6)}|${"-".repeat(6)}|${"-".repeat(6)}|${"-".repeat(6)}|${"-".repeat(6)}|${"-".repeat(13)}|`,
  );
  const scores: PairScore[] = [];
  for (let i = 0; i < runs.length; i++) {
    for (let j = i + 1; j < runs.length; j++) {
      const s = scorePair(runs[i], runs[j]);
      scores.push(s);
      const fmt = (x: number) => x.toFixed(2).replace(/^0\./, ".");
      console.log(
        `| ${pad(`${s.a_id.slice(0, 24)} vs ${s.b_id.slice(0, 24)}`, 52)} | ${rp(fmt(s.axis1_active_jaccard), 4)} | ${rp(fmt(s.axis2_overlay_jaccard), 4)} | ${rp(fmt(s.axis3_workflow_task_jaccard), 4)} | ${rp(s.axis4_alloc_l1.toFixed(2), 4)} | ${rp(fmt(s.axis5_connector_jaccard), 4)} | ${rp(fmt(s.axis6_drygate_jaccard), 4)} | ${rp(s.axis7_strategy_same ? "1" : "0", 4)} | ${rp(s.axis8_mc_l2.toFixed(2), 4)} | ${rp(s.flat_axis_count, 4)} | ${pad(s.verdict, 11)} |`,
      );
    }
  }
  console.log();

  // Table 2 — per-axis flatness across all pairs
  const axisFlatCounts = {
    axis1: scores.filter((s) => s.axis1_active_jaccard > FLAT.axis1).length,
    axis2: scores.filter((s) => s.axis2_overlay_jaccard > FLAT.axis2).length,
    axis3: scores.filter((s) => s.axis3_workflow_task_jaccard > FLAT.axis3).length,
    axis4: scores.filter((s) => s.axis4_alloc_l1 < FLAT.axis4).length,
    axis5: scores.filter((s) => s.axis5_connector_jaccard > FLAT.axis5).length,
    axis6: scores.filter((s) => s.axis6_drygate_jaccard > FLAT.axis6).length,
    axis7: scores.filter((s) => s.axis7_strategy_same).length,
    axis8: scores.filter((s) => s.axis8_mc_l2 < FLAT.axis8).length,
  };
  const totalPairs = scores.length;
  console.log("## Table 2 · Which axes are flat across the most pairs");
  console.log();
  console.log(`| Axis | Flat pair count | % of pairs | Diagnosis |`);
  console.log(`|---|---:|---:|---|`);
  const diagnose = (n: number) => {
    const pct = (n / totalPairs) * 100;
    if (pct > 70) return "⚠ severely flat";
    if (pct > 40) return "⚠ partially flat";
    if (pct > 20) return "some flatness";
    return "surface-like";
  };
  console.log(`| 1 · active-agent set | ${axisFlatCounts.axis1} | ${((axisFlatCounts.axis1 / totalPairs) * 100).toFixed(0)}% | ${diagnose(axisFlatCounts.axis1)} |`);
  console.log(`| 2 · skill-overlay tokens | ${axisFlatCounts.axis2} | ${((axisFlatCounts.axis2 / totalPairs) * 100).toFixed(0)}% | ${diagnose(axisFlatCounts.axis2)} |`);
  console.log(`| 3 · workflow task names | ${axisFlatCounts.axis3} | ${((axisFlatCounts.axis3 / totalPairs) * 100).toFixed(0)}% | ${diagnose(axisFlatCounts.axis3)} |`);
  console.log(`| 4 · bundle allocation L1 | ${axisFlatCounts.axis4} | ${((axisFlatCounts.axis4 / totalPairs) * 100).toFixed(0)}% | ${diagnose(axisFlatCounts.axis4)} |`);
  console.log(`| 5 · connector set | ${axisFlatCounts.axis5} | ${((axisFlatCounts.axis5 / totalPairs) * 100).toFixed(0)}% | ${diagnose(axisFlatCounts.axis5)} |`);
  console.log(`| 6 · dry-run gates | ${axisFlatCounts.axis6} | ${((axisFlatCounts.axis6 / totalPairs) * 100).toFixed(0)}% | ${diagnose(axisFlatCounts.axis6)} |`);
  console.log(`| 7 · MC winner | ${axisFlatCounts.axis7} | ${((axisFlatCounts.axis7 / totalPairs) * 100).toFixed(0)}% | ${diagnose(axisFlatCounts.axis7)} |`);
  console.log(`| 8 · MC projection L2 | ${axisFlatCounts.axis8} | ${((axisFlatCounts.axis8 / totalPairs) * 100).toFixed(0)}% | ${diagnose(axisFlatCounts.axis8)} |`);
  console.log();

  // Table 3 — MC mode routing vs expectation
  console.log("## Table 3 · MC strategy + mode routing vs expectation");
  console.log();
  console.log(`| ${pad("Fixture", 40)} | ${pad("Expected mode", 15)} | ${pad("Actual mode", 15)} | ${pad("Match", 8)} |`);
  console.log(`|${"-".repeat(42)}|${"-".repeat(17)}|${"-".repeat(17)}|${"-".repeat(10)}|`);
  let modeMatches = 0;
  for (const r of runs) {
    const expected = String(r.expected.mc_mode ?? "unknown");
    const match = expected === r.mc_mode ? "✓" : "✗";
    if (match === "✓") modeMatches += 1;
    console.log(`| ${pad(r.id, 40)} | ${pad(expected, 15)} | ${pad(r.mc_mode, 15)} | ${pad(match, 8)} |`);
  }
  console.log();
  console.log(`**MC mode match rate: ${modeMatches}/${runs.length}**`);

  // Summary
  console.log();
  console.log("## Summary · Surface vs Curve verdict per pair");
  console.log();
  const curveCount = scores.filter((s) => s.verdict === "curve").length;
  const borderlineCount = scores.filter((s) => s.verdict === "borderline").length;
  const surfaceCount = scores.filter((s) => s.verdict === "surface").length;
  console.log(`- **Surface pairs (≤ 2 flat axes):** ${surfaceCount} / ${totalPairs}`);
  console.log(`- **Borderline pairs (3–4 flat axes):** ${borderlineCount} / ${totalPairs}`);
  console.log(`- **Curve pairs (≥ 5 flat axes):** ${curveCount} / ${totalPairs}`);
  console.log();

  if (curveCount === 0) {
    console.log(`✓ **Solution surface confirmed** — no pair is flat across ≥ 5 of the 8 axes.`);
  } else {
    console.log(`⚠ **${curveCount} curve pair${curveCount === 1 ? "" : "s"} still present** — each is indistinguishable on ≥ 5 axes simultaneously.`);
    console.log();
    console.log("### Curve pairs requiring logic intervention:");
    for (const s of scores.filter((x) => x.verdict === "curve")) {
      console.log(`- \`${s.a_id}\` vs \`${s.b_id}\` — flat on ${s.flat_axis_count} axes`);
    }
  }
  console.log();
}

main().catch((err) => {
  console.error("run-matrix failed:", err);
  process.exit(1);
});
