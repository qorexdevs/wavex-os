/** Bridge test — manifest → DB → row counts + idempotency + reports_to chain. */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CompanyManifest } from "@wavex-os/plugin-onboarding";
import { eq } from "drizzle-orm";
import { _resetDbCache, getDb, runMigrations, agents, companies } from "@wavex-os/db";
import { bridgeAgents } from "../src/bridge/finalize-bridge.js";
import { agentIdForSlot } from "../src/bridge/catalog.js";

let tempDir: string;

beforeAll(async () => {
  tempDir = mkdtempSync(join(tmpdir(), "wavex-bridge-"));
  process.env.WAVEX_OS_STATE_DIR = tempDir;
  process.env.WAVEX_DB_DATA_DIR = join(tempDir, "db");
  _resetDbCache();
  await runMigrations();
});

afterAll(() => {
  delete process.env.WAVEX_OS_STATE_DIR;
  delete process.env.WAVEX_DB_DATA_DIR;
  _resetDbCache();
  rmSync(tempDir, { recursive: true, force: true });
});

function fixtureManifest(orgId: string): CompanyManifest {
  // Minimal CompanyManifest — only fields bridgeAgents reads.
  // Cast covers the unread fields we don't populate.
  return {
    org_id: orgId,
    pillar_responses: {
      test: true,
      pillar_1: { industry_hint: "saas-b2b", manual_context: "test fixture" },
      pillar_3: { stage: "10k_100k_mrr" },
      pillar_4: { sales_motion: "assisted_demo", lead_sources: ["outbound_cold"] },
    },
    connector_manifest: { required: [], suggested: [], deferred: [], blocked_on_manual_approval: [] },
    swarm_manifest: {
      agents: {
        "ceo.orchestrator": {
          status: "active", adapter: "claude-code", heartbeat: "15m",
          budget_monthly_usd: 300, skill_overlay: null, department: "ceo",
          level: "L·II", reports_to: null, spawnable: false,
        },
        cpo: {
          status: "active", adapter: "claude-code", heartbeat: "1h",
          budget_monthly_usd: 120, skill_overlay: null, department: "product",
          level: "L·III", reports_to: "ceo.orchestrator", spawnable: false,
        },
        "cpo.build": {
          status: "active", adapter: "claude-code", heartbeat: "2h",
          budget_monthly_usd: 80, skill_overlay: null, department: "product",
          level: "L·IV", reports_to: "cpo", spawnable: true,
        },
        "cpo.qa": {
          status: "standby", adapter: "claude-code", heartbeat: "4h",
          budget_monthly_usd: 60, skill_overlay: null, department: "product",
          level: "L·IV", reports_to: "cpo", spawnable: false,
          waiting_on_connector: "github-api",
        },
        cmo: {
          status: "parked", adapter: "claude-code", heartbeat: "1h",
          budget_monthly_usd: 120, skill_overlay: null, department: "marketing",
          level: "L·III", reports_to: "ceo.orchestrator", spawnable: false,
          unpark_condition: "first paying customer",
        },
        "cmo.demand": {
          status: "disabled", adapter: "claude-code", heartbeat: "2h",
          budget_monthly_usd: 80, skill_overlay: null, department: "marketing",
          level: "L·IV", reports_to: "cmo", spawnable: true,
          reason: "operator deferred all demand-gen work",
        },
      },
    },
  } as unknown as CompanyManifest;
}

describe("bridgeAgents (Slice 1)", () => {
  it("inserts companies + agents on first run", async () => {
    const db = await getDb();
    const result = await bridgeAgents(fixtureManifest("acme"), "co-acme", db);
    expect(result.companies).toBe(1);
    expect(result.agents).toBe(6);
  });

  it("every inserted agent has a non-null template_id", async () => {
    const db = await getDb();
    const rows = await db.select().from(agents).where(eq(agents.companyId, "co-acme"));
    expect(rows.length).toBe(6);
    for (const row of rows) {
      expect(row.templateId, `slot ${row.slot} missing templateId`).toBeTruthy();
    }
  });

  it("reports_to chains resolve via reports_to_agent_id", async () => {
    const db = await getDb();
    const rows = await db.select().from(agents).where(eq(agents.companyId, "co-acme"));
    const bySlot = new Map(rows.map((r) => [r.slot, r]));

    const ceo = bySlot.get("ceo.orchestrator")!;
    expect(ceo.reportsToAgentId).toBeNull();

    const cpo = bySlot.get("cpo")!;
    expect(cpo.reportsToAgentId).toBe(agentIdForSlot("co-acme", "ceo.orchestrator"));
    expect(cpo.reportsToSlot).toBe("ceo.orchestrator");

    const cpoBuild = bySlot.get("cpo.build")!;
    expect(cpoBuild.reportsToAgentId).toBe(agentIdForSlot("co-acme", "cpo"));
  });

  it("preserves manifest status verbatim (active/standby/parked/disabled)", async () => {
    const db = await getDb();
    const rows = await db.select().from(agents).where(eq(agents.companyId, "co-acme"));
    const statusBySlot = Object.fromEntries(rows.map((r) => [r.slot, r.status]));
    expect(statusBySlot["ceo.orchestrator"]).toBe("active");
    expect(statusBySlot["cpo.qa"]).toBe("standby");
    expect(statusBySlot["cmo"]).toBe("parked");
    expect(statusBySlot["cmo.demand"]).toBe("disabled");
  });

  it("upserts companies row to state=active with pillar_responses", async () => {
    const db = await getDb();
    const rows = await db.select().from(companies).where(eq(companies.id, "co-acme"));
    expect(rows.length).toBe(1);
    expect(rows[0]!.state).toBe("active");
    expect(rows[0]!.name).toBe("acme");
    expect((rows[0]!.pillarResponses as { test?: boolean })?.test).toBe(true);
  });

  it("idempotent — second run returns same counts, no duplicate rows", async () => {
    const db = await getDb();
    const result = await bridgeAgents(fixtureManifest("acme"), "co-acme", db);
    expect(result.companies).toBe(1);
    expect(result.agents).toBe(6);
    const rows = await db.select().from(agents).where(eq(agents.companyId, "co-acme"));
    expect(rows.length).toBe(6); // not 12
  });
});
