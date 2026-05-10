/** Token accounting for T2 calls.
 *
 *  The vendored op-omega phase modules call tier-router internally and
 *  discard the cost data at the route boundary, so we cannot read tokens
 *  from the wavex-side response. Instead, the spawn shim
 *  (scripts/wavex-claude-spawn.sh) parses claude CLI's JSON output and
 *  appends one event per call to ~/.wavex-os/state/t2-events.jsonl.
 *
 *  `withTokenAccounting(companyId, phase, fn)` records the wall-clock
 *  window of the route handler, awaits it, then sweeps the events file for
 *  any events that fired within that window and attributes them to
 *  (companyId, phase) in the per-company token-usage.json aggregate.
 *
 *  Limitation: attribution is by time window, not request id. For the
 *  single-operator dev flow this is exact. For concurrent onboardings of
 *  different companies in the same node process, events that overlap two
 *  windows could get mis-attributed. Acceptable for V1; real fix is an
 *  AsyncLocalStorage tag passed through to the spawn (deferred). */

import { readFile, writeFile, mkdir, appendFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { getOnboardingDir } from "../state-bridge.js";

export type PhaseKey =
  | "pillar_1" | "pillar_2" | "pillar_3" | "pillar_4" | "pillar_5"
  | "connector_manifest" | "swarm_manifest" | "workflow_manifest"
  | "finalize" | "recommend_agent";

interface T2Event {
  ts_iso: string;
  pid: number;
  started_ms: number;
  ended_ms: number;
  duration_ms: number;
  input_tokens: number;
  output_tokens: number;
  cached_input_tokens: number;
  cost_usd: number;
  exit_code: number;
}

interface PhaseAggregate {
  input_tokens: number;
  output_tokens: number;
  cached_input_tokens: number;
  cost_usd: number;
  duration_ms: number;
  calls: number;
  last_call_at?: string;
}

export interface TokenUsageFile {
  companyId: string;
  started_at: string;
  updated_at: string;
  total: PhaseAggregate;
  by_phase: Partial<Record<PhaseKey, PhaseAggregate>>;
  /** Last N call records, newest last. Capped to keep file size bounded. */
  recent_calls: Array<{
    phase: PhaseKey;
    ts_iso: string;
    input_tokens: number;
    output_tokens: number;
    cached_input_tokens: number;
    cost_usd: number;
    duration_ms: number;
  }>;
}

const RECENT_CALLS_CAP = 100;

function eventsFilePath(): string {
  const root = process.env.WAVEX_OS_STATE_DIR ?? join(homedir(), ".wavex-os");
  return join(root, "state", "t2-events.jsonl");
}

function tokenUsagePath(companyId: string): string {
  return join(getOnboardingDir(companyId), "token-usage.json");
}

function emptyAggregate(): PhaseAggregate {
  return {
    input_tokens: 0, output_tokens: 0, cached_input_tokens: 0,
    cost_usd: 0, duration_ms: 0, calls: 0,
  };
}

function emptyFile(companyId: string): TokenUsageFile {
  const now = new Date().toISOString();
  return {
    companyId,
    started_at: now,
    updated_at: now,
    total: emptyAggregate(),
    by_phase: {},
    recent_calls: [],
  };
}

/** Read events file once. Returns events with started_ms in [from, to]. */
async function readEventsInWindow(fromMs: number, toMs: number): Promise<T2Event[]> {
  const path = eventsFilePath();
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    return []; // file may not exist yet
  }
  const events: T2Event[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const ev = JSON.parse(line) as T2Event;
      if (ev.started_ms >= fromMs && ev.ended_ms <= toMs + 1000) {
        events.push(ev);
      }
    } catch {
      // skip malformed lines
    }
  }
  return events;
}

export async function readTokenUsage(companyId: string): Promise<TokenUsageFile | null> {
  try {
    const raw = await readFile(tokenUsagePath(companyId), "utf8");
    return JSON.parse(raw) as TokenUsageFile;
  } catch {
    return null;
  }
}

async function writeTokenUsage(companyId: string, file: TokenUsageFile): Promise<void> {
  const path = tokenUsagePath(companyId);
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await writeFile(tmp, JSON.stringify(file, null, 2), "utf8");
  // Atomic rename to avoid partial reads.
  const { rename } = await import("node:fs/promises");
  await rename(tmp, path);
}

function mergeInto(agg: PhaseAggregate, ev: T2Event): void {
  agg.input_tokens += ev.input_tokens;
  agg.output_tokens += ev.output_tokens;
  agg.cached_input_tokens += ev.cached_input_tokens;
  agg.cost_usd += ev.cost_usd;
  agg.duration_ms += ev.duration_ms;
  agg.calls += 1;
  agg.last_call_at = ev.ts_iso;
}

/** Wraps a route handler. Sweeps the events file after the await for any
 *  T2 calls that completed during the handler's execution and attributes
 *  them to (companyId, phase). */
export async function withTokenAccounting<T>(
  companyId: string,
  phase: PhaseKey,
  fn: () => Promise<T>,
): Promise<T> {
  const startMs = Date.now();
  const result = await fn();
  const endMs = Date.now();

  const events = await readEventsInWindow(startMs, endMs);
  if (events.length === 0) return result;

  const file = (await readTokenUsage(companyId)) ?? emptyFile(companyId);
  for (const ev of events) {
    mergeInto(file.total, ev);
    const phaseAgg = (file.by_phase[phase] ??= emptyAggregate());
    mergeInto(phaseAgg, ev);
    file.recent_calls.push({
      phase,
      ts_iso: ev.ts_iso,
      input_tokens: ev.input_tokens,
      output_tokens: ev.output_tokens,
      cached_input_tokens: ev.cached_input_tokens,
      cost_usd: ev.cost_usd,
      duration_ms: ev.duration_ms,
    });
  }
  if (file.recent_calls.length > RECENT_CALLS_CAP) {
    file.recent_calls = file.recent_calls.slice(-RECENT_CALLS_CAP);
  }
  file.updated_at = new Date().toISOString();
  await writeTokenUsage(companyId, file);
  return result;
}

/** Reset the aggregate file when an operator resets a company. */
export async function clearTokenUsage(companyId: string): Promise<void> {
  try {
    const { unlink } = await import("node:fs/promises");
    await unlink(tokenUsagePath(companyId));
  } catch {
    // ignore — file may not exist
  }
}
