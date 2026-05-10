/**
 * OPΩ-ONB-TEST-001-rev2 · Step 5 · QA Record Writer
 *
 * Persists `OnboardingQARecord` entries per §I.2 for longitudinal analysis.
 *
 * Backend:
 *   - Default: JSONL append to `qa/records.jsonl` — zero dependencies,
 *     trivial to query with `jq`, simple to aggregate.
 *   - Future: Paperclip Postgres table `onboarding_qa_records` can be added
 *     via a Drizzle migration when longitudinal analysis demands it. The
 *     JSONL → Postgres loader is deferred (§I.3 doesn't require it up-front).
 *
 * Records accumulate forever — never truncated. Rotation is the analyzer's
 * problem, not the writer's.
 */

import { mkdir, appendFile, readFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";

import type { ManifestDiff } from "../harness/compute-manifest-diff.js";
import type { PillarResponses } from "../../../src/index.js";

export interface OnboardingQARecord {
  fixture_id: string;
  run_id: string;
  timestamp: string;
  input_signature: string;     // sha256 of pillar_responses (minus timestamps)
  manifest_hash: string;       // from company.manifest.signatures
  diff_from_baseline?: ManifestDiff;
  suite_results?: {
    divergence?: boolean;
    stability?: boolean;
    coverage?: boolean;
    inference_value?: boolean;
  };
  anomaly_flags: string[];
  t2_call_count: number;
  t2_cost_estimate: number;    // informational USD; Max-plan subscription is zero
  /** Optional per-phase wall-clock timings. */
  timings?: Record<string, number>;
  /** Optional prompt version identifiers used in this run (§I.6). */
  prompt_versions?: Record<string, string>;
  notes?: string;
}

const QA_DIR_DEFAULT = join(process.cwd(), "packages/plugins/onboarding/test/differential-equation-suite/qa");
const JSONL_FILE_DEFAULT = "records.jsonl";

export interface QARecordWriterOptions {
  qaDir?: string;
  jsonlFile?: string;
}

async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export function inputSignature(responses: PillarResponses): string {
  const canon = JSON.stringify({
    pillar_1: responses.pillar_1,
    pillar_2: responses.pillar_2,
    pillar_3: responses.pillar_3,
    pillar_4: responses.pillar_4,
    pillar_5: responses.pillar_5,
  });
  return `sha256:${createHash("sha256").update(canon).digest("hex")}`;
}

export async function writeQARecord(record: OnboardingQARecord, options: QARecordWriterOptions = {}): Promise<string> {
  const qaDir = options.qaDir ?? QA_DIR_DEFAULT;
  const jsonl = join(qaDir, options.jsonlFile ?? JSONL_FILE_DEFAULT);
  await ensureDir(dirname(jsonl));
  await appendFile(jsonl, JSON.stringify(record) + "\n", "utf8");
  return jsonl;
}

export interface QAAnomalyDetectorInput {
  diff?: ManifestDiff;
  t2CallCount?: number;
  halted?: boolean;
  /** Expected min diff thresholds if this is a Suite 1 comparison. */
  expectedDiff?: {
    connector_min?: number;
    agent_status_min?: number;
    allocation_l1_min?: number;
  };
}

/**
 * Examines a diff/result and returns anomaly flags to attach to the QA
 * record. Flags drive the longitudinal analyzer (§I.3).
 */
export function detectAnomalies(input: QAAnomalyDetectorInput): string[] {
  const flags: string[] = [];

  if (input.halted) flags.push("pipeline_halted");

  if (input.diff && input.expectedDiff) {
    const { connectors_diff, agents_diff, allocations_diff } = input.diff;
    const connectorCount = connectors_diff.added.length + connectors_diff.removed.length + connectors_diff.moved_priority.length;
    const agentStatusCount = agents_diff.status_changed.length + agents_diff.spawn_eligibility_changed.length;

    if (typeof input.expectedDiff.connector_min === "number" && connectorCount < input.expectedDiff.connector_min) {
      flags.push(`low_connector_divergence:${connectorCount}<${input.expectedDiff.connector_min}`);
    }
    if (typeof input.expectedDiff.agent_status_min === "number" && agentStatusCount < input.expectedDiff.agent_status_min) {
      flags.push(`low_agent_divergence:${agentStatusCount}<${input.expectedDiff.agent_status_min}`);
    }
    if (typeof input.expectedDiff.allocation_l1_min === "number" && allocations_diff.l1_distance < input.expectedDiff.allocation_l1_min) {
      flags.push(`low_allocation_shift:${allocations_diff.l1_distance.toFixed(3)}<${input.expectedDiff.allocation_l1_min}`);
    }
  }

  if (typeof input.t2CallCount === "number" && input.t2CallCount > 10) {
    flags.push(`excess_t2_calls:${input.t2CallCount}`);
  }

  return flags;
}

export async function readAllQARecords(options: QARecordWriterOptions = {}): Promise<OnboardingQARecord[]> {
  const qaDir = options.qaDir ?? QA_DIR_DEFAULT;
  const jsonl = join(qaDir, options.jsonlFile ?? JSONL_FILE_DEFAULT);
  try {
    await access(jsonl);
  } catch {
    return [];
  }
  const raw = await readFile(jsonl, "utf8");
  const lines = raw.split("\n").filter((l) => l.length > 0);
  const records: OnboardingQARecord[] = [];
  for (const line of lines) {
    try {
      records.push(JSON.parse(line) as OnboardingQARecord);
    } catch {
      // skip corrupted line
    }
  }
  return records;
}
