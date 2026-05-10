#!/usr/bin/env node
/** PGlite-only: wipe the data directory and re-run migrations. Refuses to
 *  run against Postgres (use a real ops procedure for prod resets). */
import { rm, mkdir } from "node:fs/promises";
import { getDbDriver, getDataDir, _resetDbCache } from "../getDb.js";
import { runMigrations } from "../migrate.js";

const driver = getDbDriver();
if (driver !== "pglite") {
  console.error(`[wavex-db] reset refused: driver=${driver}; only PGlite is wipeable`);
  process.exit(1);
}
const dir = getDataDir();
console.log(`[wavex-db] wiping ${dir}`);
await rm(dir, { recursive: true, force: true });
await mkdir(dir, { recursive: true });
_resetDbCache();
await runMigrations();
console.log("[wavex-db] reset complete");
process.exit(0);
