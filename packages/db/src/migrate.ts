/** Apply migrations against the configured driver. Uses the SQL files in
 *  ./migrations/ produced by `drizzle-kit generate`. */
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { migrate as migratePg } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { getDb, getDbDriver } from "./getDb.js";

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_FOLDER = resolve(here, "..", "migrations");

export async function runMigrations(): Promise<void> {
  const db = (await getDb()) as never;
  const driver = getDbDriver();
  if (driver === "pg") {
    await migratePg(db, { migrationsFolder: MIGRATIONS_FOLDER });
  } else {
    await migratePglite(db, { migrationsFolder: MIGRATIONS_FOLDER });
  }
}
