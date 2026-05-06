#!/usr/bin/env node
/**
 * WaveX OS — mock Paperclip core.
 *
 * In-memory, single-process stand-in for the real Paperclip server. Speaks just
 * enough of the Paperclip API for the onboarding wizard's step 9 (spawn) and
 * step 10 (handoff) to feel real before Phase D wires the actual subtree.
 *
 * Endpoints:
 *   GET  /api/health
 *   POST /api/spawn        body: { agents: SpawnAgent[] }   → { runId }
 *   GET  /api/spawn/:runId/events  (SSE)
 *   GET  /api/agents
 *   GET  /api/runs/:runId
 */

import Fastify from "fastify";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

const PORT = Number(process.env.WAVEX_MOCK_CORE_PORT ?? 3101);
const HOST = process.env.WAVEX_MOCK_CORE_HOST ?? "127.0.0.1";
const STATE_DIR = process.env.WAVEX_OS_STATE_DIR ?? join(homedir(), ".wavex-os");
const COMPANY_NAME = process.env.WAVEX_OS_COMPANY_NAME ?? "default";
const COMPANY_DIR = join(STATE_DIR, "instances", COMPANY_NAME);

if (!existsSync(COMPANY_DIR)) mkdirSync(COMPANY_DIR, { recursive: true });

interface SpawnAgent {
  slot: string;
  templateId: string;
  reportsToSlot?: string;
  ownedKpiIds?: string[];
}

interface AgentRecord extends SpawnAgent {
  agentId: string;
  status: "pending" | "spawning" | "ready" | "failed";
  spawnedAt?: string;
}

interface SpawnEvent {
  ts: number;
  level: "info" | "ok" | "warn" | "error";
  message: string;
  agentId?: string;
}

interface SpawnRun {
  runId: string;
  startedAt: number;
  finishedAt?: number;
  status: "running" | "succeeded" | "failed";
  events: SpawnEvent[];
  /** SSE subscribers — a callback invoked when a new event lands. */
  subscribers: Set<(ev: SpawnEvent | { type: "done"; status: SpawnRun["status"] }) => void>;
}

const agents: AgentRecord[] = loadAgents();
const runs = new Map<string, SpawnRun>();

function loadAgents(): AgentRecord[] {
  const path = join(COMPANY_DIR, "agents.json");
  if (!existsSync(path)) return [];
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return [];
  }
}

function persistAgents(): void {
  writeFileSync(join(COMPANY_DIR, "agents.json"), JSON.stringify(agents, null, 2));
}

function newId(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

function emit(run: SpawnRun, ev: SpawnEvent): void {
  run.events.push(ev);
  for (const fn of run.subscribers) fn(ev);
}

async function spawnOne(run: SpawnRun, slot: SpawnAgent, idx: number, total: number): Promise<void> {
  emit(run, { ts: Date.now(), level: "info", message: `[${idx + 1}/${total}] preparing ${slot.slot} (${slot.templateId})` });
  await sleep(220 + Math.random() * 200);

  // Simulated spawn steps
  emit(run, { ts: Date.now(), level: "info", message: `  - reading template skill at packages/agent-templates/${slot.templateId}/SKILL.md` });
  await sleep(140);

  emit(run, { ts: Date.now(), level: "info", message: `  - registering KPIs: ${(slot.ownedKpiIds ?? []).join(", ") || "(none)"}` });
  await sleep(160);

  emit(run, { ts: Date.now(), level: "info", message: `  - allocating heartbeat schedule (no timer until first wake)` });
  await sleep(140);

  const agentId = newId("ag");
  const record: AgentRecord = {
    ...slot,
    agentId,
    status: "ready",
    spawnedAt: new Date().toISOString(),
  };
  agents.push(record);
  persistAgents();

  emit(run, { ts: Date.now(), level: "ok", message: `  ✓ spawned ${slot.slot} → ${agentId}`, agentId });
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

const app = Fastify({ logger: false });

// --- routes ---------------------------------------------------------------

app.get("/api/health", async () => ({
  ok: true,
  service: "wavex-os-mock-core",
  version: "0.1.0",
  agents: agents.length,
  runs: runs.size,
  companyDir: COMPANY_DIR,
}));

app.get("/api/agents", async () => ({ agents }));

app.get<{ Params: { runId: string } }>("/api/runs/:runId", async (req, reply) => {
  const run = runs.get(req.params.runId);
  if (!run) {
    reply.code(404);
    return { error: "not found" };
  }
  return {
    runId: run.runId,
    status: run.status,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    events: run.events,
  };
});

app.post<{ Body: { agents: SpawnAgent[] } }>("/api/spawn", async (req, reply) => {
  const body = req.body;
  if (!body || !Array.isArray(body.agents) || body.agents.length === 0) {
    reply.code(400);
    return { error: "expected { agents: SpawnAgent[] } with at least one agent" };
  }

  const runId = newId("run");
  const run: SpawnRun = {
    runId,
    startedAt: Date.now(),
    status: "running",
    events: [],
    subscribers: new Set(),
  };
  runs.set(runId, run);

  // kick off async spawn — don't await
  (async () => {
    emit(run, { ts: Date.now(), level: "info", message: `wavex-os mock-core spawn started for ${body.agents.length} agents` });
    try {
      for (let i = 0; i < body.agents.length; i++) {
        await spawnOne(run, body.agents[i]!, i, body.agents.length);
      }
      run.status = "succeeded";
      run.finishedAt = Date.now();
      emit(run, { ts: Date.now(), level: "ok", message: `All ${body.agents.length} agents ready. Total time ${(run.finishedAt - run.startedAt) / 1000}s.` });
    } catch (err) {
      run.status = "failed";
      run.finishedAt = Date.now();
      emit(run, { ts: Date.now(), level: "error", message: `spawn failed: ${(err as Error).message}` });
    }
    for (const fn of run.subscribers) fn({ type: "done", status: run.status });
  })();

  return { runId };
});

app.get<{ Params: { runId: string } }>("/api/spawn/:runId/events", async (req, reply) => {
  const run = runs.get(req.params.runId);
  if (!run) {
    reply.code(404);
    return { error: "not found" };
  }

  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  // Replay any events that already happened
  for (const ev of run.events) {
    reply.raw.write(`event: progress\ndata: ${JSON.stringify(ev)}\n\n`);
  }
  if (run.status !== "running") {
    reply.raw.write(`event: done\ndata: ${JSON.stringify({ status: run.status })}\n\n`);
    reply.raw.end();
    return reply;
  }

  // Subscribe to live events
  const handler = (ev: SpawnEvent | { type: "done"; status: SpawnRun["status"] }) => {
    if ("type" in ev && ev.type === "done") {
      reply.raw.write(`event: done\ndata: ${JSON.stringify({ status: ev.status })}\n\n`);
      reply.raw.end();
    } else {
      reply.raw.write(`event: progress\ndata: ${JSON.stringify(ev)}\n\n`);
    }
  };
  run.subscribers.add(handler);

  req.raw.on("close", () => {
    run.subscribers.delete(handler);
  });

  return reply;
});

// --- boot -----------------------------------------------------------------

app.listen({ host: HOST, port: PORT }).then(() => {
  // eslint-disable-next-line no-console
  console.log(`[wavex-mock-core] listening on http://${HOST}:${PORT}`);
  console.log(`[wavex-mock-core] state dir: ${COMPANY_DIR}`);
}).catch((err) => {
  // eslint-disable-next-line no-console
  console.error(`[wavex-mock-core] failed to start:`, err);
  process.exit(1);
});
