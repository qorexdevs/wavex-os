#!/usr/bin/env node
import { runMigrations } from "../migrate.js";
import { getDbDriver, getDataDir } from "../getDb.js";

const driver = getDbDriver();
console.log(`[wavex-db] driver=${driver}${driver === "pglite" ? ` data=${getDataDir()}` : ""}`);
await runMigrations();
console.log("[wavex-db] migrations applied");
process.exit(0);
