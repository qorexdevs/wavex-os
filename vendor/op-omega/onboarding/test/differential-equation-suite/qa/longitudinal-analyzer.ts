/**
 * OPΩ-ONB-TEST-001-rev2 · Step 13 · Longitudinal Analyzer
 *
 * Reads the accumulated JSONL QA corpus and surfaces pattern-level insights:
 *
 *   1. Pillar propagation strength — which pillars consistently fail to
 *      produce downstream diff (the "cosmetic pillar" detector)
 *   2. Fixture stability — for each fixture that appears multiple times,
 *      how consistent are the manifests across runs
 *   3. Surface compression — hash clustering; too many runs → too few distinct
 *      manifests = curve territory
 *   4. Inference efficiency — T2 calls per anomaly vs T2 calls per pass
 *
 * Pure read-over-records; no side effects. Consumed by the report generator
 * and by CLI `tsx longitudinal-analyzer.ts --print`.
 */

import { readAllQARecords, type OnboardingQARecord } from "./qa-record-writer.js";

export interface PillarPropagationFinding {
  pillar: 1 | 3 | 4 | 5;
  total_records: number;
  low_connector_count: number;
  low_agent_count: number;
  low_allocation_count: number;
  /** 0.0 - 1.0, where 1.0 means perfect propagation. */
  signal_strength: number;
}

export interface FixtureStabilityFinding {
  fixture_id: string;
  run_count: number;
  distinct_manifest_hashes: number;
  /** 1.0 = perfectly stable; <1 = variance detected. */
  stability_score: number;
}

export interface SurfaceCompressionFinding {
  total_records_with_hash: number;
  distinct_hashes: number;
  /** Top-N most common hashes and how many records share each. */
  top_clusters: Array<{ hash: string; count: number }>;
  /** Records-per-hash ratio. >3 suggests compression. */
  compression_ratio: number;
}

export interface InferenceEfficiencyFinding {
  total_records: number;
  mean_t2_calls_per_record: number;
  t2_calls_on_passes: number;
  t2_calls_on_failures: number;
  anomaly_per_t2_call: number;
}

export interface LongitudinalReport {
  generated_at: string;
  corpus_size: number;
  pillar_propagation: PillarPropagationFinding[];
  fixture_stability: FixtureStabilityFinding[];
  surface_compression: SurfaceCompressionFinding;
  inference_efficiency: InferenceEfficiencyFinding;
  top_flags: Array<{ flag: string; count: number }>;
}

function detectPillarFromFixtureId(id: string): 1 | 3 | 4 | 5 | null {
  const m = id.match(/__p([1345])_/);
  return m ? (parseInt(m[1], 10) as 1 | 3 | 4 | 5) : null;
}

function analyzePillarPropagation(records: OnboardingQARecord[]): PillarPropagationFinding[] {
  // Only live records (t2_call_count > 0) tell us about propagation — deterministic-only
  // runs have no inference variance, so "low divergence" is expected and tells us nothing.
  const liveRecords = records.filter((r) => (r.t2_call_count ?? 0) > 0);
  const byPillar: Record<1 | 3 | 4 | 5, OnboardingQARecord[]> = { 1: [], 3: [], 4: [], 5: [] };
  for (const r of liveRecords) {
    const p = detectPillarFromFixtureId(r.fixture_id);
    if (p) byPillar[p].push(r);
  }
  return ([1, 3, 4, 5] as const).map((pillar) => {
    const rs = byPillar[pillar];
    const lowConn = rs.filter((r) => r.anomaly_flags.some((f) => f.startsWith("low_connector_divergence"))).length;
    const lowAgent = rs.filter((r) => r.anomaly_flags.some((f) => f.startsWith("low_agent_divergence"))).length;
    const lowAlloc = rs.filter((r) => r.anomaly_flags.some((f) => f.startsWith("low_allocation_shift"))).length;
    const total = rs.length;
    // Signal strength: 1 - (fraction of records with any low-divergence flag).
    const anyLow = rs.filter((r) =>
      r.anomaly_flags.some((f) => f.startsWith("low_connector_divergence") || f.startsWith("low_agent_divergence") || f.startsWith("low_allocation_shift")),
    ).length;
    const signal_strength = total === 0 ? 0 : Math.round((1 - anyLow / total) * 100) / 100;
    return {
      pillar,
      total_records: total,
      low_connector_count: lowConn,
      low_agent_count: lowAgent,
      low_allocation_count: lowAlloc,
      signal_strength,
    };
  });
}

function analyzeFixtureStability(records: OnboardingQARecord[]): FixtureStabilityFinding[] {
  const byFixture = new Map<string, OnboardingQARecord[]>();
  for (const r of records) {
    if (!byFixture.has(r.fixture_id)) byFixture.set(r.fixture_id, []);
    byFixture.get(r.fixture_id)!.push(r);
  }
  const findings: FixtureStabilityFinding[] = [];
  for (const [fixture_id, rs] of byFixture.entries()) {
    if (rs.length < 2) continue;
    const hashes = new Set(rs.map((r) => r.manifest_hash).filter(Boolean));
    const stability_score = Math.round((1 / Math.max(1, hashes.size)) * 100) / 100;
    findings.push({
      fixture_id,
      run_count: rs.length,
      distinct_manifest_hashes: hashes.size,
      stability_score,
    });
  }
  return findings.sort((a, b) => a.stability_score - b.stability_score);
}

function analyzeSurfaceCompression(records: OnboardingQARecord[]): SurfaceCompressionFinding {
  const withHash = records.filter((r) => r.manifest_hash);
  const counts = new Map<string, number>();
  for (const r of withHash) {
    counts.set(r.manifest_hash, (counts.get(r.manifest_hash) ?? 0) + 1);
  }
  const top_clusters = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([hash, count]) => ({ hash, count }));
  const distinct = counts.size;
  const total = withHash.length;
  return {
    total_records_with_hash: total,
    distinct_hashes: distinct,
    top_clusters,
    compression_ratio: distinct === 0 ? 0 : Math.round((total / distinct) * 100) / 100,
  };
}

function analyzeInferenceEfficiency(records: OnboardingQARecord[]): InferenceEfficiencyFinding {
  if (records.length === 0) {
    return {
      total_records: 0,
      mean_t2_calls_per_record: 0,
      t2_calls_on_passes: 0,
      t2_calls_on_failures: 0,
      anomaly_per_t2_call: 0,
    };
  }
  const totalT2 = records.reduce((acc, r) => acc + (r.t2_call_count ?? 0), 0);
  const passes = records.filter((r) =>
    r.suite_results && Object.values(r.suite_results).some((v) => v === true),
  );
  const failures = records.filter((r) =>
    r.suite_results && Object.values(r.suite_results).some((v) => v === false),
  );
  const passT2 = passes.reduce((acc, r) => acc + (r.t2_call_count ?? 0), 0);
  const failT2 = failures.reduce((acc, r) => acc + (r.t2_call_count ?? 0), 0);
  const anomalyCount = records.reduce((acc, r) => acc + r.anomaly_flags.length, 0);
  return {
    total_records: records.length,
    mean_t2_calls_per_record: Math.round((totalT2 / records.length) * 100) / 100,
    t2_calls_on_passes: passT2,
    t2_calls_on_failures: failT2,
    anomaly_per_t2_call: totalT2 === 0 ? 0 : Math.round((anomalyCount / totalT2) * 100) / 100,
  };
}

function topFlags(records: OnboardingQARecord[]): Array<{ flag: string; count: number }> {
  const counts = new Map<string, number>();
  for (const r of records) {
    for (const f of r.anomaly_flags ?? []) {
      const key = f.split(":")[0];
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([flag, count]) => ({ flag, count }));
}

export async function runLongitudinalAnalysis(): Promise<LongitudinalReport> {
  const records = await readAllQARecords();
  return {
    generated_at: new Date().toISOString(),
    corpus_size: records.length,
    pillar_propagation: analyzePillarPropagation(records),
    fixture_stability: analyzeFixtureStability(records),
    surface_compression: analyzeSurfaceCompression(records),
    inference_efficiency: analyzeInferenceEfficiency(records),
    top_flags: topFlags(records),
  };
}

export function renderLongitudinalMarkdown(r: LongitudinalReport): string {
  const lines: string[] = [];
  lines.push(`## Longitudinal analysis · corpus = ${r.corpus_size} records`);
  lines.push("");

  lines.push(`### Pillar propagation strength`);
  lines.push("");
  lines.push(`| Pillar | Records | Low-connector | Low-agent | Low-allocation | Signal |`);
  lines.push(`|---:|---:|---:|---:|---:|---:|`);
  for (const p of r.pillar_propagation) {
    lines.push(`| ${p.pillar} | ${p.total_records} | ${p.low_connector_count} | ${p.low_agent_count} | ${p.low_allocation_count} | ${(p.signal_strength * 100).toFixed(0)}% |`);
  }
  lines.push("");

  lines.push(`### Surface compression`);
  lines.push("");
  lines.push(`- ${r.surface_compression.total_records_with_hash} records · ${r.surface_compression.distinct_hashes} distinct manifest hashes · compression ratio ${r.surface_compression.compression_ratio}`);
  if (r.surface_compression.top_clusters.length > 0) {
    lines.push(`- Top clusters:`);
    for (const c of r.surface_compression.top_clusters) {
      lines.push(`  - \`${c.hash.slice(0, 20)}…\` × ${c.count}`);
    }
  }
  lines.push("");

  if (r.fixture_stability.length > 0) {
    lines.push(`### Fixture stability (fixtures seen ≥ 2 runs)`);
    lines.push("");
    lines.push(`| Fixture | Runs | Distinct hashes | Stability |`);
    lines.push(`|---|---:|---:|---:|`);
    for (const f of r.fixture_stability.slice(0, 10)) {
      lines.push(`| \`${f.fixture_id}\` | ${f.run_count} | ${f.distinct_manifest_hashes} | ${f.stability_score} |`);
    }
    lines.push("");
  }

  lines.push(`### Inference efficiency`);
  lines.push("");
  lines.push(`- Mean T2 calls per record: **${r.inference_efficiency.mean_t2_calls_per_record}**`);
  lines.push(`- T2 on passes: ${r.inference_efficiency.t2_calls_on_passes} · on failures: ${r.inference_efficiency.t2_calls_on_failures}`);
  lines.push(`- Anomalies per T2 call: ${r.inference_efficiency.anomaly_per_t2_call}`);
  lines.push("");

  if (r.top_flags.length > 0) {
    lines.push(`### Top anomaly flags (max 10)`);
    lines.push("");
    for (const f of r.top_flags) {
      lines.push(`- \`${f.flag}\` × ${f.count}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// CLI entry
const isMain = typeof process !== "undefined" && Array.isArray(process.argv) && process.argv[1]?.endsWith("longitudinal-analyzer.ts");
if (isMain) {
  runLongitudinalAnalysis()
    .then((r) => {
      process.stdout.write(renderLongitudinalMarkdown(r));
    })
    .catch((err) => {
      process.stderr.write(`longitudinal analysis failed: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    });
}
