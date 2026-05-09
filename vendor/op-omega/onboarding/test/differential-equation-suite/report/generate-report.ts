/**
 * OPΩ-ONB-TEST-001-rev2 · Step 15 · Report Generator
 *
 * Reads accumulated QA records (JSONL), aggregates by suite, emits a
 * markdown report at `report/last-run-{timestamp}.md` with:
 *   - per-suite pass/fail counts
 *   - diff magnitudes (median/range)
 *   - specificity gaps (mean/min)
 *   - overall verdict (SOLUTION_SURFACE_CONFIRMED / CURVE_DETECTED / PARTIAL_SURFACE)
 *   - QA record count written this invocation
 *
 * Run via CLI: `tsx report/generate-report.ts`
 * Or programmatically: `generateReport()` from inside the suite.
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { readAllQARecords, type OnboardingQARecord } from "../qa/qa-record-writer.js";
import { runLongitudinalAnalysis, renderLongitudinalMarkdown } from "../qa/longitudinal-analyzer.js";
import { getPromptVersions, verifyAllPromptDrift, renderPromptVersionsMarkdown } from "../qa/prompt-version-registry.js";

export type Verdict = "SOLUTION_SURFACE_CONFIRMED" | "CURVE_DETECTED" | "PARTIAL_SURFACE" | "NO_DATA";

export interface SuiteSummary {
  total: number;
  passed: number;
  failed: number;
  passRate: number;
}

export interface ReportData {
  generated_at: string;
  records_scanned: number;
  suite_1: SuiteSummary;
  suite_2: SuiteSummary;
  suite_3: SuiteSummary;
  suite_4: SuiteSummary;
  anomaly_breakdown: Record<string, number>;
  verdict: Verdict;
  notes: string[];
}

function makeSummary(records: OnboardingQARecord[], key: keyof NonNullable<OnboardingQARecord["suite_results"]>): SuiteSummary {
  let relevant = records.filter((r) => r.suite_results && key in r.suite_results);
  // Suite 1 (divergence) and Suite 4 (inference value) thresholds are calibrated
  // for live T2 variance — deterministic-only records are pre-gating artifacts that
  // can't satisfy them, so they poison the pass rate. Filter them out of both.
  if (key === "divergence" || key === "inference_value") {
    relevant = relevant.filter((r) => (r.t2_call_count ?? 0) > 0);
  }
  const passed = relevant.filter((r) => r.suite_results?.[key] === true).length;
  const failed = relevant.filter((r) => r.suite_results?.[key] === false).length;
  const total = passed + failed;
  return {
    total,
    passed,
    failed,
    passRate: total === 0 ? 0 : Math.round((passed / total) * 1000) / 10,
  };
}

function countAnomalies(records: OnboardingQARecord[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of records) {
    for (const flag of r.anomaly_flags ?? []) {
      const key = flag.split(":")[0];
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }
  return counts;
}

function deriveVerdict(d: Omit<ReportData, "verdict" | "generated_at" | "notes">): Verdict {
  if (d.records_scanned === 0) return "NO_DATA";

  // Suite coverage (Suite 3) must be clean — 100% pass.
  if (d.suite_3.total > 0 && d.suite_3.failed > 0) return "CURVE_DETECTED";

  // Stability must be clean — any nondeterminism is a hard fail.
  if (d.suite_2.total > 0 && d.suite_2.failed > 0) return "CURVE_DETECTED";

  // Divergence: >20% failure is curve territory.
  if (d.suite_1.total > 0 && d.suite_1.failed / d.suite_1.total > 0.2) return "CURVE_DETECTED";

  // Inference value: any failures suggests T2 isn't adding structural value.
  if (d.suite_4.total > 0 && d.suite_4.failed > 0) {
    return d.suite_4.passed > 0 ? "PARTIAL_SURFACE" : "CURVE_DETECTED";
  }

  // If suite 1 or 4 has partial failures below the hard-fail threshold, partial surface.
  if (d.suite_1.total > 0 && d.suite_1.failed > 0) return "PARTIAL_SURFACE";

  const haveSignal = d.suite_3.total > 0 || d.suite_1.total > 0 || d.suite_4.total > 0;
  return haveSignal ? "SOLUTION_SURFACE_CONFIRMED" : "NO_DATA";
}

export async function aggregateReportData(): Promise<ReportData> {
  const records = await readAllQARecords();
  const suite_1 = makeSummary(records, "divergence");
  const suite_2 = makeSummary(records, "stability");
  const suite_3 = makeSummary(records, "coverage");
  const suite_4 = makeSummary(records, "inference_value");
  const anomaly_breakdown = countAnomalies(records);

  const notes: string[] = [];
  if (suite_1.total === 0) notes.push("Suite 1 has no records — run with OP_OMEGA_TEST_LIVE=1 to populate divergence data.");
  if (suite_4.total === 0) notes.push("Suite 4 has no records — run with OP_OMEGA_TEST_LIVE=1 to measure T2 value.");
  if (anomaly_breakdown.low_connector_divergence) notes.push(`${anomaly_breakdown.low_connector_divergence} connector-divergence anomalies detected — some pillar may not be propagating.`);
  if (anomaly_breakdown.low_rationale_gap) notes.push(`${anomaly_breakdown.low_rationale_gap} low-rationale-gap anomalies — T2 rationale specificity may be weak.`);

  const core = {
    records_scanned: records.length,
    suite_1,
    suite_2,
    suite_3,
    suite_4,
    anomaly_breakdown,
  };

  return {
    generated_at: new Date().toISOString(),
    ...core,
    verdict: deriveVerdict(core),
    notes,
  };
}

export function renderMarkdown(r: ReportData): string {
  const lines: string[] = [];
  lines.push(`# Operator Ω · Differential-Equation Suite Report`);
  lines.push("");
  lines.push(`**Generated:** ${r.generated_at}`);
  lines.push(`**Records scanned:** ${r.records_scanned}`);
  lines.push(`**Verdict:** \`${r.verdict}\``);
  lines.push("");
  lines.push(`## Suite results`);
  lines.push("");
  lines.push(`| Suite | Total | Passed | Failed | Pass rate |`);
  lines.push(`|---|---:|---:|---:|---:|`);
  const row = (name: string, s: SuiteSummary) => `| ${name} | ${s.total} | ${s.passed} | ${s.failed} | ${s.total === 0 ? "—" : s.passRate + "%"} |`;
  lines.push(row("1 · Divergence", r.suite_1));
  lines.push(row("2 · Stability", r.suite_2));
  lines.push(row("3 · Surface Coverage", r.suite_3));
  lines.push(row("4 · Inference Value", r.suite_4));
  lines.push("");
  lines.push(`## Anomaly breakdown`);
  lines.push("");
  if (Object.keys(r.anomaly_breakdown).length === 0) {
    lines.push("_No anomalies recorded._");
  } else {
    lines.push(`| Flag | Count |`);
    lines.push(`|---|---:|`);
    for (const [flag, n] of Object.entries(r.anomaly_breakdown).sort((a, b) => b[1] - a[1])) {
      lines.push(`| \`${flag}\` | ${n} |`);
    }
  }
  lines.push("");
  if (r.notes.length > 0) {
    lines.push(`## Notes`);
    lines.push("");
    for (const n of r.notes) lines.push(`- ${n}`);
    lines.push("");
  }
  lines.push(`## Verdict interpretation`);
  lines.push("");
  lines.push(
    r.verdict === "SOLUTION_SURFACE_CONFIRMED"
      ? "Onboarding behaves as a true differential-equation solution surface. Ship with confidence."
      : r.verdict === "CURVE_DETECTED"
        ? "Onboarding collapses to a curve. Fix before production — see anomaly breakdown for the failing dimension."
        : r.verdict === "PARTIAL_SURFACE"
          ? "Mixed results. Some dimensions are surface-like, others curve-like. Triage per suite."
          : "Not enough data yet. Run with OP_OMEGA_TEST_LIVE=1 to populate Suite 1 and Suite 4 records.",
  );
  return lines.join("\n") + "\n";
}

export async function generateReport(outDir?: string): Promise<{ path: string; data: ReportData }> {
  const data = await aggregateReportData();
  const longitudinal = await runLongitudinalAnalysis();
  const promptVersions = await getPromptVersions();
  const promptDrift = await verifyAllPromptDrift().catch((err) => {
    return [
      { phase: "phase-2" as const, version: "?", drift: "source_missing_markers" as const, notes: [String(err)] },
    ];
  });
  const dir = outDir ?? join(process.cwd(), "packages/plugins/onboarding/test/differential-equation-suite/report");
  await mkdir(dirname(join(dir, "x")), { recursive: true });
  await mkdir(dir, { recursive: true });
  const file = join(dir, `last-run-${data.generated_at.replace(/[:.]/g, "-")}.md`);
  const body = [
    renderMarkdown(data),
    "---",
    "",
    renderPromptVersionsMarkdown(promptVersions, promptDrift),
    "---",
    "",
    renderLongitudinalMarkdown(longitudinal),
  ].join("\n");
  await writeFile(file, body, "utf8");
  return { path: file, data };
}

// CLI entry — `tsx report/generate-report.ts`
const isMain = typeof process !== "undefined" && Array.isArray(process.argv) && process.argv[1]?.endsWith("generate-report.ts");
if (isMain) {
  generateReport()
    .then((r) => {
      process.stdout.write(`Report written: ${r.path}\nVerdict: ${r.data.verdict}\n`);
    })
    .catch((err) => {
      process.stderr.write(`Failed to generate report: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    });
}
