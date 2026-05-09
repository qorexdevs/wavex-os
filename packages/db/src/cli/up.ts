#!/usr/bin/env node
/** Boot the database: ensures data dir exists (PGlite) or pings the server
 *  (Postgres), then runs migrations. Idempotent. */
import { mkdir } from "node:fs/promises";
import { runMigrations } from "../migrate.js";
import { getDb, getDbDriver, getDataDir } from "../getDb.js";

const driver = getDbDriver();
if (driver === "pglite") {
  await mkdir(getDataDir(), { recursive: true });
}
await getDb();
await runMigrations();
console.log(`[wavex-db] up (driver=${driver})`);
process.exit(0);
