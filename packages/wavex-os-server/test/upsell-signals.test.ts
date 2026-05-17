/** Integration tests for upsell signal evaluation (WAVAAAA-71).
 *
 *  Tests verify that:
 *   - all 3 signals fire correctly at / above their thresholds
 *   - signals do NOT fire below threshold
 *   - each fired signal produces the right signal_type and context_json shape
 *   - expansion_eligible_set reflects whether any signal fired
 *   - DB writes are best-effort (no Supabase in CI → persisted=false, ok=true)
 *
 *  Uses Fastify inject so no real HTTP server is needed.
 *  WAVEX_AUTH_MODE=dev bypasses assertBoard, SUPABASE_URL unset → best-effort. */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type Server } from "node:http";
import Fastify from "fastify";
import { registerWavexOsRoutes } from "../src/index.js";
import { evaluateSignals, createExpansionIssue, type ExpansionIssueParams } from "../src/routes/upsell-signals.js";

const BASE_BODY = {
  companyId: "test-co",
  partner_id: "partner-abc",
  partner_name: "Acme Mobile",
  test_run_count_30d: 0,
  app_count: 0,
  ci_pass_rate_7d: null,
};

let app: ReturnType<typeof Fastify>;
let tempDir: string;

beforeEach(async () => {
  tempDir = mkdtempSync(join(tmpdir(), "upsell-signals-test-"));
  process.env.WAVEX_OS_STATE_DIR = tempDir;
  process.env.PAPERCLIP_DATA_DIR = tempDir;
  process.env.WAVEX_AUTH_MODE = "dev";
  process.env.WAVEX_COMPOSIO_DISABLED = "1";
  // No SUPABASE_URL → writes are best-effort no-ops in tests.
  delete process.env.SUPABASE_URL;

  app = Fastify({ logger: false });
  registerWavexOsRoutes(app);
  await app.ready();
});

afterEach(async () => {
  await app.close();
  delete process.env.WAVEX_OS_STATE_DIR;
  delete process.env.PAPERCLIP_DATA_DIR;
  delete process.env.WAVEX_AUTH_MODE;
  delete process.env.WAVEX_COMPOSIO_DISABLED;
  rmSync(tempDir, { recursive: true, force: true });
});

// ─── pure evaluateSignals unit tests ──────────────────────────────────────

describe("evaluateSignals (pure)", () => {
  it("fires upsell.volume when test_run_count_30d > 50", () => {
    const fired = evaluateSignals({ ...BASE_BODY, test_run_count_30d: 51 });
    expect(fired.map((s) => s.signal_type)).toContain("upsell.volume");
    const sig = fired.find((s) => s.signal_type === "upsell.volume")!;
    expect(sig.context_json.test_run_count_30d).toBe(51);
    expect(sig.context_json.threshold).toBe(50);
  });

  it("does NOT fire upsell.volume at exactly 50 runs", () => {
    const fired = evaluateSignals({ ...BASE_BODY, test_run_count_30d: 50 });
    expect(fired.map((s) => s.signal_type)).not.toContain("upsell.volume");
  });

  it("fires upsell.expansion when app_count >= 2", () => {
    const fired = evaluateSignals({ ...BASE_BODY, app_count: 2 });
    expect(fired.map((s) => s.signal_type)).toContain("upsell.expansion");
    const sig = fired.find((s) => s.signal_type === "upsell.expansion")!;
    expect(sig.context_json.app_count).toBe(2);
  });

  it("does NOT fire upsell.expansion with app_count = 1", () => {
    const fired = evaluateSignals({ ...BASE_BODY, app_count: 1 });
    expect(fired.map((s) => s.signal_type)).not.toContain("upsell.expansion");
  });

  it("fires upsell.health when ci_pass_rate_7d > 80", () => {
    const fired = evaluateSignals({ ...BASE_BODY, ci_pass_rate_7d: 81 });
    expect(fired.map((s) => s.signal_type)).toContain("upsell.health");
    const sig = fired.find((s) => s.signal_type === "upsell.health")!;
    expect(sig.context_json.ci_pass_rate_7d).toBe(81);
    expect(sig.context_json.threshold).toBe(80);
  });

  it("does NOT fire upsell.health at exactly 80%", () => {
    const fired = evaluateSignals({ ...BASE_BODY, ci_pass_rate_7d: 80 });
    expect(fired.map((s) => s.signal_type)).not.toContain("upsell.health");
  });

  it("does NOT fire upsell.health when ci_pass_rate_7d is null", () => {
    const fired = evaluateSignals({ ...BASE_BODY, ci_pass_rate_7d: null });
    expect(fired.map((s) => s.signal_type)).not.toContain("upsell.health");
  });

  it("fires all 3 signals when all thresholds are exceeded", () => {
    const fired = evaluateSignals({
      ...BASE_BODY,
      test_run_count_30d: 100,
      app_count: 3,
      ci_pass_rate_7d: 95,
    });
    const types = fired.map((s) => s.signal_type);
    expect(types).toContain("upsell.volume");
    expect(types).toContain("upsell.expansion");
    expect(types).toContain("upsell.health");
  });

  it("returns empty array when no thresholds are met", () => {
    const fired = evaluateSignals({ ...BASE_BODY });
    expect(fired).toHaveLength(0);
  });
});

// ─── HTTP integration tests ────────────────────────────────────────────────

describe("POST /api/upsell-signals/evaluate", () => {
  it("returns ok=true with no signals when thresholds not met", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/upsell-signals/evaluate",
      payload: BASE_BODY,
    });
    expect(r.statusCode).toBe(200);
    const body = r.json();
    expect(body.ok).toBe(true);
    expect(body.signals_fired).toHaveLength(0);
    expect(body.expansion_eligible_set).toBe(false);
  });

  it("fires upsell.expansion signal via HTTP (no Supabase → persisted=false)", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/upsell-signals/evaluate",
      payload: { ...BASE_BODY, app_count: 2 },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json();
    expect(body.ok).toBe(true);
    expect(body.expansion_eligible_set).toBe(true);
    expect(body.signals_fired).toHaveLength(1);
    expect(body.signals_fired[0].signal_type).toBe("upsell.expansion");
    expect(body.signals_fired[0].context_json.app_count).toBe(2);
    // No Supabase in test → best-effort write → persisted=false
    expect(body.signals_fired[0].persisted).toBe(false);
  });

  it("fires upsell.volume signal via HTTP", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/upsell-signals/evaluate",
      payload: { ...BASE_BODY, test_run_count_30d: 75 },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json();
    expect(body.signals_fired[0].signal_type).toBe("upsell.volume");
    expect(body.signals_fired[0].context_json.test_run_count_30d).toBe(75);
  });

  it("fires upsell.health signal via HTTP", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/upsell-signals/evaluate",
      payload: { ...BASE_BODY, ci_pass_rate_7d: 90 },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json();
    expect(body.signals_fired[0].signal_type).toBe("upsell.health");
    expect(body.signals_fired[0].context_json.ci_pass_rate_7d).toBe(90);
  });

  it("fires all 3 signals in one evaluate call", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/upsell-signals/evaluate",
      payload: {
        ...BASE_BODY,
        test_run_count_30d: 100,
        app_count: 3,
        ci_pass_rate_7d: 95,
      },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json();
    expect(body.ok).toBe(true);
    expect(body.signals_fired).toHaveLength(3);
    expect(body.expansion_eligible_set).toBe(true);
    const types = body.signals_fired.map((s: { signal_type: string }) => s.signal_type);
    expect(types).toContain("upsell.volume");
    expect(types).toContain("upsell.expansion");
    expect(types).toContain("upsell.health");
  });

  it("returns 400 for missing required fields", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/upsell-signals/evaluate",
      payload: { partner_id: "x" },
    });
    expect(r.statusCode).toBe(400);
    expect(r.json().ok).toBe(false);
  });
});

describe("GET /api/upsell-signals/:partnerId", () => {
  it("returns 503 when Supabase is not configured", async () => {
    const r = await app.inject({
      method: "GET",
      url: "/api/upsell-signals/partner-abc",
    });
    expect(r.statusCode).toBe(503);
    expect(r.json().ok).toBe(false);
  });
});

// ─── createExpansionIssue unit tests ──────────────────────────────────────

const BASE_EXPANSION_PARAMS: ExpansionIssueParams = {
  partner_id: "partner-xyz",
  partner_name: "Acme Mobile",
  signal_type: "upsell.expansion",
  context_json: { app_count: 2 },
  snapshot: {
    companyId: "test-co",
    partner_id: "partner-xyz",
    partner_name: "Acme Mobile",
    test_run_count_30d: 75,
    app_count: 2,
    ci_pass_rate_7d: 85,
  },
};

describe("createExpansionIssue", () => {
  let mockServer: Server;
  let mockBaseUrl: string;
  let lastBody: Record<string, unknown> | null = null;
  let mockStatusCode = 201;

  beforeAll(async () => {
    mockServer = createServer((req, res) => {
      res.setHeader("Content-Type", "application/json");
      if (req.method === "POST" && req.url?.includes("/issues")) {
        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("end", () => {
          lastBody = JSON.parse(body) as Record<string, unknown>;
          if (mockStatusCode !== 201) {
            res.writeHead(mockStatusCode);
            res.end(JSON.stringify({ error: "simulated failure" }));
            return;
          }
          res.writeHead(201);
          res.end(JSON.stringify({
            id: "00000000-1234-4000-8000-000000000001",
            identifier: "WAVAAAA-99",
            title: lastBody.title,
          }));
        });
        return;
      }
      res.writeHead(404);
      res.end(JSON.stringify({ error: "unhandled" }));
    });
    await new Promise<void>((resolve) => mockServer.listen(0, "127.0.0.1", resolve));
    const addr = mockServer.address();
    if (!addr || typeof addr === "string") throw new Error("expected AddressInfo");
    mockBaseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(() => { mockServer.close(); });

  beforeEach(() => {
    lastBody = null;
    mockStatusCode = 201;
    process.env.PAPERCLIP_HANDOFF_URL = mockBaseUrl;
    process.env.PAPERCLIP_OPS_API_KEY = "test-api-key";
    process.env.PAPERCLIP_OPS_COMPANY_ID = "co-ops-uuid";
    process.env.PAPERCLIP_OPS_EXPANSION_AGENT_ID = "agent-cro-uuid";
  });

  afterEach(() => {
    delete process.env.PAPERCLIP_HANDOFF_URL;
    delete process.env.PAPERCLIP_OPS_API_KEY;
    delete process.env.PAPERCLIP_OPS_COMPANY_ID;
    delete process.env.PAPERCLIP_OPS_EXPANSION_AGENT_ID;
    delete process.env.PAPERCLIP_OPS_EXPANSION_PARENT_ISSUE_ID;
    delete process.env.PAPERCLIP_OPS_EXPANSION_GOAL_ID;
  });

  it("returns null and skips when env vars are not set", async () => {
    delete process.env.PAPERCLIP_HANDOFF_URL;
    const result = await createExpansionIssue(BASE_EXPANSION_PARAMS);
    expect(result).toBeNull();
    expect(lastBody).toBeNull(); // mock server not hit
  });

  it("creates a Paperclip issue with correct title and priority", async () => {
    const result = await createExpansionIssue(BASE_EXPANSION_PARAMS);
    expect(result).not.toBeNull();
    expect(result?.identifier).toBe("WAVAAAA-99");
    expect(result?.issue_id).toBe("00000000-1234-4000-8000-000000000001");
    expect(lastBody?.title).toBe("[EXPANSION] Acme Mobile — upsell.expansion opportunity");
    expect(lastBody?.priority).toBe("high");
    expect(lastBody?.assigneeAgentId).toBe("agent-cro-uuid");
  });

  it("includes parent and goal IDs when env vars are set", async () => {
    process.env.PAPERCLIP_OPS_EXPANSION_PARENT_ISSUE_ID = "parent-uuid";
    process.env.PAPERCLIP_OPS_EXPANSION_GOAL_ID = "goal-uuid";
    await createExpansionIssue(BASE_EXPANSION_PARAMS);
    expect(lastBody?.parentId).toBe("parent-uuid");
    expect(lastBody?.goalId).toBe("goal-uuid");
  });

  it("issue body includes partner name, apps, test-run volume, CI pass rate, and context", async () => {
    await createExpansionIssue(BASE_EXPANSION_PARAMS);
    const desc = lastBody?.description as string;
    expect(desc).toContain("Acme Mobile");
    expect(desc).toContain("upsell.expansion");
    expect(desc).toContain("75"); // test_run_count_30d
    expect(desc).toContain("85%"); // ci_pass_rate_7d
    expect(desc).toContain("app_count"); // context_json key
  });

  it("returns null on Paperclip API error (best-effort)", async () => {
    mockStatusCode = 500;
    const result = await createExpansionIssue(BASE_EXPANSION_PARAMS);
    expect(result).toBeNull();
  });

  it("includes paperclip_issue in evaluate HTTP response when Paperclip is configured", async () => {
    // Re-create app with Paperclip env set
    const testApp = Fastify({ logger: false });
    registerWavexOsRoutes(testApp);
    await testApp.ready();
    try {
      const r = await testApp.inject({
        method: "POST",
        url: "/api/upsell-signals/evaluate",
        payload: { ...BASE_BODY, app_count: 2 },
      });
      expect(r.statusCode).toBe(200);
      const body = r.json();
      expect(body.signals_fired[0].paperclip_issue).not.toBeNull();
      expect(body.signals_fired[0].paperclip_issue.identifier).toBe("WAVAAAA-99");
    } finally {
      await testApp.close();
    }
  });
});
