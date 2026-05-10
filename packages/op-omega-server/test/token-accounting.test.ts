/** Token accounting unit test — exercises withTokenAccounting against a
 *  real on-disk t2-events.jsonl, verifying that events fired during the
 *  awaited fn get aggregated into the per-company token-usage.json. */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, appendFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withTokenAccounting, readTokenUsage, clearTokenUsage, getPhaseEta, getAllPhaseEtas } from "../src/lib/token-accounting.js";

let root: string;
let eventsPath: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "wavex-tokens-"));
  process.env.WAVEX_OS_STATE_DIR = root;
  mkdirSync(join(root, "state"), { recursive: true });
  eventsPath = join(root, "state", "t2-events.jsonl");
});

afterAll(() => {
  delete process.env.WAVEX_OS_STATE_DIR;
  rmSync(root, { recursive: true, force: true });
});

beforeEach(() => {
  // Truncate events between tests so they don't bleed across windows
  if (existsSync(eventsPath)) rmSync(eventsPath);
  // Wipe per-company aggregates so getAllPhaseEtas starts from zero history
  const instancesDir = join(root, "instances");
  if (existsSync(instancesDir)) rmSync(instancesDir, { recursive: true, force: true });
});

/** Append an event with started_ms = now (i.e. firing inside the active
 *  withTokenAccounting window). For "stale event" tests, pass a negative
 *  offset to put started_ms in the past. */
function writeEvent(opts: {
  in: number;
  out: number;
  cached?: number;
  cost?: number;
  durationMs?: number;
  startedMsOffset?: number; // 0 = now, negative = in past, positive = future
}): void {
  const now = Date.now();
  const started = now + (opts.startedMsOffset ?? 0);
  const duration = opts.durationMs ?? 50;
  const ended = started + duration;
  const ev = {
    ts_iso: new Date(ended).toISOString(),
    pid: 1,
    started_ms: started,
    ended_ms: ended,
    duration_ms: duration,
    input_tokens: opts.in,
    output_tokens: opts.out,
    cached_input_tokens: opts.cached ?? 0,
    cost_usd: opts.cost ?? 0.001,
    exit_code: 0,
  };
  appendFileSync(eventsPath, JSON.stringify(ev) + "\n");
}

describe("withTokenAccounting", () => {
  it("returns the wrapped fn's result unchanged when no events fire", async () => {
    const result = await withTokenAccounting("co-empty", "pillar_1", async () => "hello");
    expect(result).toBe("hello");
    const usage = await readTokenUsage("co-empty");
    expect(usage).toBeNull(); // no events → no file written
  });

  it("attributes events fired during the await window to (companyId, phase)", async () => {
    const result = await withTokenAccounting("co-attrib", "pillar_1", async () => {
      // Simulate a T2 event happening mid-await (started_ms = now)
      writeEvent({ in: 1000, out: 500, cost: 0.05 });
      await new Promise((r) => setTimeout(r, 30));
      return "done";
    });
    expect(result).toBe("done");
    const usage = await readTokenUsage("co-attrib");
    expect(usage).not.toBeNull();
    expect(usage!.total.calls).toBe(1);
    expect(usage!.total.input_tokens).toBe(1000);
    expect(usage!.total.output_tokens).toBe(500);
    expect(usage!.by_phase.pillar_1?.input_tokens).toBe(1000);
    expect(usage!.recent_calls).toHaveLength(1);
    expect(usage!.recent_calls[0].phase).toBe("pillar_1");
  });

  it("ignores events outside the await window", async () => {
    // Event with started_ms 10s in the past — before our wrapper's window
    writeEvent({ startedMsOffset: -10_000, in: 999, out: 999, cost: 1 });
    await new Promise((r) => setTimeout(r, 5));
    await withTokenAccounting("co-window", "pillar_1", async () => "ok");
    const usage = await readTokenUsage("co-window");
    expect(usage).toBeNull(); // stale event was outside window → no file
  });

  it("aggregates multiple events per phase + multiple phases per company", async () => {
    await withTokenAccounting("co-multi", "pillar_1", async () => {
      writeEvent({ in: 100, out: 50, cost: 0.01 });
      writeEvent({ in: 200, out: 100, cost: 0.02 });
      await new Promise((r) => setTimeout(r, 10));
    });
    await withTokenAccounting("co-multi", "swarm_manifest", async () => {
      writeEvent({ in: 500, out: 250, cost: 0.05 });
      await new Promise((r) => setTimeout(r, 10));
    });
    const usage = await readTokenUsage("co-multi");
    expect(usage!.total.calls).toBe(3);
    expect(usage!.total.input_tokens).toBe(800);
    expect(usage!.total.output_tokens).toBe(400);
    expect(usage!.by_phase.pillar_1?.calls).toBe(2);
    expect(usage!.by_phase.pillar_1?.input_tokens).toBe(300);
    expect(usage!.by_phase.swarm_manifest?.calls).toBe(1);
    expect(usage!.by_phase.swarm_manifest?.input_tokens).toBe(500);
  });

  it("getPhaseEta returns defaults with is_default=true when no history exists", async () => {
    const eta = await getPhaseEta("pillar_1");
    // No companies in this fresh tmp dir → defaults
    expect(eta.is_default).toBe(true);
    expect(eta.samples).toBe(0);
    expect(eta.median_ms).toBeGreaterThan(0);
    expect(eta.p90_ms).toBeGreaterThanOrEqual(eta.median_ms);
  });

  it("getPhaseEta computes median + p90 from cross-company recent_calls", async () => {
    // Seed three companies with pillar_1 calls of 1s, 2s, 3s.
    // Add a small sleep between iterations so each call's startMs is strictly
    // after the previous event's started_ms — otherwise readEventsInWindow's
    // [fromMs, toMs] filter can include the prior iteration's event AND each
    // call's own, double-counting the event in earlier iterations.
    for (const [id, durMs] of [["co-eta-a", 1000], ["co-eta-b", 2000], ["co-eta-c", 3000]] as const) {
      await new Promise((r) => setTimeout(r, 10));
      await withTokenAccounting(id, "pillar_1", async () => {
        await new Promise((r) => setTimeout(r, 1));
        writeEvent({ in: 100, out: 50, durationMs: durMs });
        await new Promise((r) => setTimeout(r, 5));
      });
    }
    for (const id of ["co-eta-a", "co-eta-b", "co-eta-c"]) {
      const u = await readTokenUsage(id);
      expect(u, `${id} usage missing`).not.toBeNull();
      expect(u!.recent_calls.length, `${id} recent_calls`).toBe(1);
    }
    const eta = await getPhaseEta("pillar_1");
    expect(eta.is_default).toBe(false);
    expect(eta.samples).toBe(3);
    expect(eta.median_ms).toBe(2000); // middle of [1000, 2000, 3000]
    expect(eta.p90_ms).toBe(3000);    // upper end

    // getAllPhaseEtas returns same row + defaults for other phases
    const all = await getAllPhaseEtas();
    expect(all.pillar_1.median_ms).toBe(2000);
    expect(all.swarm_manifest.is_default).toBe(true); // no history for this phase
  });

  it("clearTokenUsage removes the aggregate file", async () => {
    await withTokenAccounting("co-clear", "pillar_1", async () => {
      writeEvent({ in: 10, out: 5 });
      await new Promise((r) => setTimeout(r, 5));
    });
    expect(await readTokenUsage("co-clear")).not.toBeNull();
    await clearTokenUsage("co-clear");
    expect(await readTokenUsage("co-clear")).toBeNull();
  });
});
