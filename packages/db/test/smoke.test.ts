/** Smoke test: PGlite boots in a temp dir, migrations apply, basic CRUD
 *  works against the schema. Validates the entire stack end-to-end without
 *  needing a Postgres server. */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { _resetDbCache, getDb } from "../src/getDb.js";
import { runMigrations } from "../src/migrate.js";
import * as schema from "../src/schema/index.js";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "wavex-db-smoke-"));
  process.env.WAVEX_DB_DRIVER = "pglite";
  process.env.WAVEX_DB_DATA_DIR = tempDir;
  _resetDbCache();
});

afterEach(() => {
  delete process.env.WAVEX_DB_DRIVER;
  delete process.env.WAVEX_DB_DATA_DIR;
  rmSync(tempDir, { recursive: true, force: true });
});

describe("@wavex-os/db smoke", () => {
  it("migrations apply against fresh PGlite instance", async () => {
    await runMigrations();
    const db = await getDb();
    const rows = await db.select().from(schema.companies);
    expect(rows).toEqual([]);
  });

  it("companies CRUD round-trips", async () => {
    await runMigrations();
    const db = await getDb();
    await db.insert(schema.companies).values({
      id: "demo-co",
      name: "Demo Co",
      industry: "AI / ML / SaaS",
      state: "draft",
    });
    const rows = await db.select().from(schema.companies).where(eq(schema.companies.id, "demo-co"));
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Demo Co");
  });

  it("agents reference companies (no FK enforcement, but schema accepts data)", async () => {
    await runMigrations();
    const db = await getDb();
    await db.insert(schema.companies).values({ id: "c1", name: "C1" });
    await db.insert(schema.agents).values({
      id: "ag_0000000000000001",
      companyId: "c1",
      name: "CEO",
      role: "ceo",
      slot: "ceo",
      tier: 1,
      ownedKpiIds: ["monthly_recurring_revenue"],
    });
    const rows = await db.select().from(schema.agents).where(eq(schema.agents.companyId, "c1"));
    expect(rows).toHaveLength(1);
    expect(rows[0].ownedKpiIds).toEqual(["monthly_recurring_revenue"]);
  });

  it("kpis + cost_events + issues all writable", async () => {
    await runMigrations();
    const db = await getDb();
    await db.insert(schema.companyKpis).values({
      companyId: "c1",
      kpiId: "monthly_recurring_revenue",
      label: "MRR",
      direction: "higher_is_better",
      targetMicros: 25000n * 1_000_000n,
      ownerRole: "ceo",
    });
    await db.insert(schema.costEvents).values({
      id: "ce_1",
      companyId: "c1",
      model: "claude-sonnet-4-6",
      inputTokens: 100,
      outputTokens: 50,
    });
    await db.insert(schema.issues).values({
      id: "iss_1",
      companyId: "c1",
      title: "Bootstrap",
    });
    const k = await db.select().from(schema.companyKpis);
    const c = await db.select().from(schema.costEvents);
    const i = await db.select().from(schema.issues);
    expect(k).toHaveLength(1);
    expect(c).toHaveLength(1);
    expect(i).toHaveLength(1);
  });
});
