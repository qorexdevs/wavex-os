#!/usr/bin/env node
/**
 * Idempotent setup script that:
 *   1. Validates the agent hierarchy (single root = CEO; CDO sub-tree under CDO; rest under CEO).
 *   2. Registers the KPIs from your kpi-registry.json into company_kpis,
 *      with owner mapping resolved from the agents table by role.
 *
 * Reads:
 *   - wavex-os.config.json (--config)        provides companyId
 *   - kpi-registry.json (cfg.kpiRegistryPath) provides the KPI list
 *
 * Database connection: env DATABASE_URL.
 *
 * Re-running this script is safe — it upserts on (company_id, kpi_id) and
 * leaves existing owner assignments alone unless explicitly different.
 */
import pg from "pg";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { config: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--config") out.config = args[++i];
  }
  return out;
}

async function loadJson(p) {
  return JSON.parse(await fs.readFile(p, "utf8"));
}

async function main() {
  const args = parseArgs();
  const cfg = await loadJson(
    args.config ?? path.join(REPO_ROOT, "wavex-os.config.json"),
  );
  if (!cfg.companyId) throw new Error("config missing companyId");

  const registryPath = path.resolve(
    REPO_ROOT,
    cfg.kpiRegistryPath ?? "examples/kpi-registry.example.json",
  );
  const registry = await loadJson(registryPath);
  if (!Array.isArray(registry.kpis)) {
    throw new Error(`KPI registry at ${registryPath} missing 'kpis' array`);
  }

  const { Client } = pg.default ?? pg;
  const c = new Client(
    process.env.DATABASE_URL ||
      "postgresql://paperclip:paperclip@localhost:54329/paperclip",
  );
  await c.connect();

  // Resolve canonical agent per role.
  const { rows: agents } = await c.query(
    `SELECT id, role, name, reports_to FROM agents
     WHERE company_id=$1 AND status NOT IN ('terminated')
     ORDER BY name`,
    [cfg.companyId],
  );
  const byRole = new Map();
  for (const a of agents) {
    if (!byRole.has(a.role)) byRole.set(a.role, a);
  }
  const idForRole = (role) => byRole.get(role)?.id ?? null;
  const ceoId = idForRole("ceo");
  const cdoId = idForRole("cdo");
  if (!ceoId) throw new Error("CEO not found — run the onboarding wizard first");

  /* ---------------- HIERARCHY ---------------- */
  console.log("=== HIERARCHY VALIDATION ===");
  const expected = [
    // [role, expected_manager_id_or_null]
    ["ceo", null],
    ["chief_of_staff", ceoId],
    ["cto", ceoId],
    ["cmo", ceoId],
    ["cro", ceoId],
    ["cdo", ceoId],
    ["coo", ceoId],
    ["cfo", ceoId],
    ["cpo", ceoId],
    ["cdo_telemetry", cdoId],
    ["cdo_attribute", cdoId],
    ["cdo_infer", cdoId],
    ["cdo_signal", cdoId],
    ["devops", ceoId], // recovery engineer; under CEO by default
  ];
  for (const [role, expectedManager] of expected) {
    const a = byRole.get(role);
    if (!a) {
      console.log(`  ${role.padEnd(20)} not present (skip)`);
      continue;
    }
    if (a.reports_to === expectedManager) {
      console.log(`  ${role.padEnd(20)} ✓ reports_to ${(expectedManager ?? "null").toString().slice(0, 8)}`);
      continue;
    }
    await c.query(
      `UPDATE agents SET reports_to=$1, updated_at=NOW() WHERE id=$2`,
      [expectedManager, a.id],
    );
    console.log(
      `  ${role.padEnd(20)} fixed: ${(a.reports_to ?? "null").toString().slice(0, 8)} → ${(expectedManager ?? "null").toString().slice(0, 8)}`,
    );
  }

  /* ---------------- KPIs ---------------- */
  console.log("\n=== KPI REGISTRATION + OWNERSHIP ===");
  for (const k of registry.kpis) {
    const ownerId = k.ownerRole ? idForRole(k.ownerRole) : null;
    const targetMicros = k.targetMicros == null ? null : BigInt(k.targetMicros);

    const { rows: existing } = await c.query(
      `SELECT id, kpi_owner_agent_id FROM company_kpis WHERE company_id=$1 AND kpi_id=$2`,
      [cfg.companyId, k.kpiId],
    );

    if (existing[0]) {
      const updates = [];
      const params = [];
      let p = 1;
      if (ownerId && existing[0].kpi_owner_agent_id !== ownerId) {
        updates.push(`kpi_owner_agent_id=$${p++}`);
        params.push(ownerId);
      }
      updates.push(`label=$${p++}`, `direction=$${p++}`, `description=$${p++}`);
      params.push(k.label, k.direction, k.description ?? null);
      if (targetMicros != null) {
        updates.push(`target_micros=$${p++}`);
        params.push(targetMicros.toString());
      }
      params.push(cfg.companyId, k.kpiId);
      await c.query(
        `UPDATE company_kpis SET ${updates.join(", ")}, updated_at=NOW() WHERE company_id=$${p++} AND kpi_id=$${p}`,
        params,
      );
      console.log(`  ${k.kpiId.padEnd(35)} updated (owner=${k.ownerRole ?? "—"})`);
    } else {
      await c.query(
        `INSERT INTO company_kpis
          (company_id, kpi_id, label, direction, target_micros, window_days, kpi_owner_agent_id, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          cfg.companyId,
          k.kpiId,
          k.label,
          k.direction,
          targetMicros == null ? null : targetMicros.toString(),
          k.windowDays,
          ownerId,
          k.description ?? null,
        ],
      );
      console.log(`  ${k.kpiId.padEnd(35)} inserted (owner=${k.ownerRole ?? "—"})`);
    }
  }

  await c.end();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("setup-hierarchy-and-kpis failed:", err.message);
  process.exit(1);
});
