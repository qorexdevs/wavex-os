/** Paperclip handoff e2e — stands up a mock Paperclip HTTP server and
 *  exercises handoffToPaperclip end-to-end. Validates that:
 *
 *    1. With PAPERCLIP_HANDOFF_URL unset, handoff is a no-op (enabled: false).
 *    2. With it set, the bridge POSTs the company + hires the V1 C-Suite
 *       (ceo.orchestrator + cpo + cmo + cro + cfo + cdo + coo) → 7 agents.
 *    3. Approval auto-acks fire when Paperclip returns a pending approval.
 *    4. The bridge persists a slot→paperclipAgentId mapping for idempotency
 *       (re-running skips already-mapped slots).
 *    5. A 500 from Paperclip on agent-hires lands in report.errors without
 *       crashing the bridge.
 *
 *  This is the highest-fidelity test we can run without a real Paperclip
 *  instance — every endpoint the handoff calls is mocked with the exact
 *  response shape the production code expects. */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CompanyManifest } from "@op-omega/plugin-onboarding";
import { handoffToPaperclip } from "../src/bridge/paperclip-handoff.js";

interface MockState {
  companies: Map<string, { id: string; name: string }>;
  hires: Array<{ paperclipCompanyId: string; payload: Record<string, unknown> }>;
  approvals: string[];
  /** When true, /agent-hires returns 500 instead of success. */
  failHires: boolean;
}

let server: Server;
let baseUrl: string;
let state: MockState;
let tempStateDir: string;

function freshState(): MockState {
  return { companies: new Map(), hires: [], approvals: [], failHires: false };
}

function buildMinimalManifest(companyId: string): CompanyManifest {
  // Only the fields the handoff inspects: signatures.manifest_hash + the
  // V1 C-Suite slots in swarm_manifest.agents.
  const slots = ["ceo.orchestrator", "cpo", "cmo", "cro", "cfo", "cdo", "coo"];
  const agents: Record<string, { reports_to: string | null; status: string; adapter: string; heartbeat: string; budget_monthly_usd: number; skill_overlay: null; department: string; level: string; spawnable: boolean }> = {};
  for (const s of slots) {
    agents[s] = {
      reports_to: s === "ceo.orchestrator" ? null : "ceo.orchestrator",
      status: "active",
      adapter: "claude-code",
      heartbeat: "4h",
      budget_monthly_usd: 60,
      skill_overlay: null,
      department: s === "ceo.orchestrator" ? "ceo" : "ops",
      level: "L·II",
      spawnable: true,
    };
  }
  return {
    org_id: companyId,
    finalized_at: new Date().toISOString(),
    pillar_responses: {} as unknown as CompanyManifest["pillar_responses"],
    swarm_manifest: {
      agents,
      spawn_eligibility: [],
      bundle_allocation_initial: {},
    } as unknown as CompanyManifest["swarm_manifest"],
    connector_manifest: { required: [], suggested: [], deferred: [] } as unknown as CompanyManifest["connector_manifest"],
    workflow_manifest: { workflows: [] } as unknown as CompanyManifest["workflow_manifest"],
    signatures: { manifest_hash: "sha256:test-hash" },
    mc_winner: null,
    imprint_summary: null,
  } as unknown as CompanyManifest;
}

beforeAll(async () => {
  // Mock Paperclip server — implements the four endpoints handoffToPaperclip calls.
  state = freshState();
  server = createServer((req, res) => {
    const url = req.url ?? "";
    res.setHeader("Content-Type", "application/json");

    // GET /api/companies/:id — used to verify a previously-mapped company still exists
    if (req.method === "GET" && url.match(/^\/api\/companies\/[^/]+$/)) {
      const id = url.split("/").pop()!;
      if (state.companies.has(id)) {
        res.writeHead(200);
        res.end(JSON.stringify(state.companies.get(id)));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: "not found" }));
      }
      return;
    }

    // POST /api/companies — create new
    if (req.method === "POST" && url === "/api/companies") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        const parsed = JSON.parse(body) as { name: string; description: string };
        const id = `pc-co-${state.companies.size + 1}`;
        state.companies.set(id, { id, name: parsed.name });
        res.writeHead(201);
        res.end(JSON.stringify({ id, name: parsed.name }));
      });
      return;
    }

    // POST /api/companies/:id/agent-hires — hire one agent
    if (req.method === "POST" && url.match(/^\/api\/companies\/[^/]+\/agent-hires$/)) {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        const paperclipCompanyId = url.split("/")[3]!;
        const payload = JSON.parse(body) as Record<string, unknown>;
        if (state.failHires) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: "simulated failure" }));
          return;
        }
        state.hires.push({ paperclipCompanyId, payload });
        const agentId = `pc-ag-${state.hires.length}`;
        const approvalId = `pc-ap-${state.hires.length}`;
        res.writeHead(201);
        res.end(JSON.stringify({
          agent: { id: agentId, status: "pending" },
          approval: { id: approvalId, status: "pending" },
        }));
      });
      return;
    }

    // POST /api/approvals/:id/approve
    if (req.method === "POST" && url.match(/^\/api\/approvals\/[^/]+\/approve$/)) {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        const approvalId = url.split("/")[3]!;
        state.approvals.push(approvalId);
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true }));
      });
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: `unhandled ${req.method} ${url}` }));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  if (addr === null || typeof addr === "string") throw new Error("expected AddressInfo");
  baseUrl = `http://127.0.0.1:${addr.port}`;

  tempStateDir = mkdtempSync(join(tmpdir(), "wavex-handoff-"));
  process.env.WAVEX_OS_STATE_DIR = tempStateDir;
});

afterAll(() => {
  server.close();
  delete process.env.WAVEX_OS_STATE_DIR;
  delete process.env.PAPERCLIP_HANDOFF_URL;
  rmSync(tempStateDir, { recursive: true, force: true });
});

beforeEach(() => {
  // Fresh mock state per test so hire counts are accurate
  state.companies.clear();
  state.hires.length = 0;
  state.approvals.length = 0;
  state.failHires = false;
  // Wipe any prior handoff mapping so we get fresh "create company" behavior
  const instancesDir = join(tempStateDir, "instances");
  rmSync(instancesDir, { recursive: true, force: true });
  mkdirSync(instancesDir, { recursive: true });
});

describe("handoffToPaperclip", () => {
  it("no-op when PAPERCLIP_HANDOFF_URL is unset", async () => {
    delete process.env.PAPERCLIP_HANDOFF_URL;
    const manifest = buildMinimalManifest("co-noop");
    const report = await handoffToPaperclip(manifest, "co-noop");
    expect(report.enabled).toBe(false);
    expect(report.paperclipUrl).toBeNull();
    expect(report.created).toEqual([]);
    expect(state.hires.length).toBe(0); // mock server not hit at all
  });

  it("hires the V1 C-Suite (7 agents) when handoff URL is set", async () => {
    process.env.PAPERCLIP_HANDOFF_URL = baseUrl;
    const manifest = buildMinimalManifest("co-fresh");
    const report = await handoffToPaperclip(manifest, "co-fresh");

    expect(report.enabled).toBe(true);
    expect(report.paperclipUrl).toBe(baseUrl);
    expect(report.paperclipCompanyId).toMatch(/^pc-co-/);
    expect(report.errors).toEqual([]);
    expect(report.created.length).toBe(7);

    // Every V1 slot should have been hired exactly once
    const hiredSlots = state.hires.map((h) => h.payload.name as string);
    expect(hiredSlots).toContain("CEO / ORCHESTRATOR");
    expect(hiredSlots.filter((n) => n === "CPO").length).toBe(1);
    expect(hiredSlots.filter((n) => n === "CMO").length).toBe(1);
    expect(hiredSlots.filter((n) => n === "CRO").length).toBe(1);
    expect(hiredSlots.filter((n) => n === "CFO").length).toBe(1);
    expect(hiredSlots.filter((n) => n === "CDO").length).toBe(1);
    expect(hiredSlots.filter((n) => n === "COO").length).toBe(1);

    // All approvals should have auto-acked
    expect(state.approvals.length).toBe(7);
    expect(report.created.every((c) => c.status === "approved")).toBe(true);
  });

  it("respects the V1 scope — non-handoff slots get reported as skipped", async () => {
    process.env.PAPERCLIP_HANDOFF_URL = baseUrl;
    const manifest = buildMinimalManifest("co-scope");
    // Add an L·IV slot that should NOT be handed off in v1
    (manifest as unknown as { swarm_manifest: { agents: Record<string, unknown> } })
      .swarm_manifest.agents["cpo.build"] = {
        reports_to: "cpo", status: "active", adapter: "claude-code",
        heartbeat: "2h", budget_monthly_usd: 60, skill_overlay: null,
        department: "ops", level: "L·IV", spawnable: true,
      };
    const report = await handoffToPaperclip(manifest, "co-scope");
    expect(report.created.length).toBe(7); // still just V1
    const skipped = report.skipped.map((s) => s.slot);
    expect(skipped).toContain("cpo.build");
    expect(report.skipped.find((s) => s.slot === "cpo.build")?.reason).toBe("outside-v1-scope");
  });

  it("idempotent — re-running skips slots already in the mapping", async () => {
    process.env.PAPERCLIP_HANDOFF_URL = baseUrl;
    const manifest = buildMinimalManifest("co-idem");
    const first = await handoffToPaperclip(manifest, "co-idem");
    expect(first.created.length).toBe(7);
    const firstHireCount = state.hires.length;

    // Second call — mapping is persisted on disk, all 7 should be skipped
    const second = await handoffToPaperclip(manifest, "co-idem");
    expect(second.created.length).toBe(0);
    const skipReasons = new Set(second.skipped.map((s) => s.reason));
    expect(skipReasons.has("already-mapped")).toBe(true);
    expect(state.hires.length).toBe(firstHireCount); // no new hires hit the mock
  });

  it("records errors per-slot when Paperclip /agent-hires returns 500", async () => {
    process.env.PAPERCLIP_HANDOFF_URL = baseUrl;
    state.failHires = true;
    const manifest = buildMinimalManifest("co-fail");
    const report = await handoffToPaperclip(manifest, "co-fail");
    expect(report.enabled).toBe(true);
    expect(report.created.length).toBe(0);
    expect(report.errors.length).toBe(7);
    expect(report.errors[0].message).toMatch(/agent-hires failed/);
  });

  it("ensurePaperclipCompany verifies existing mapping before re-creating", async () => {
    process.env.PAPERCLIP_HANDOFF_URL = baseUrl;
    const manifest = buildMinimalManifest("co-verify");
    const first = await handoffToPaperclip(manifest, "co-verify");
    const firstCompanyId = first.paperclipCompanyId!;
    const companiesAfterFirst = state.companies.size;
    expect(companiesAfterFirst).toBe(1);

    // Run again — should reuse the same paperclipCompanyId, not POST /api/companies again
    const second = await handoffToPaperclip(manifest, "co-verify");
    expect(second.paperclipCompanyId).toBe(firstCompanyId);
    expect(state.companies.size).toBe(1);
  });
});
