/** Driver factory: returns a Drizzle instance backed by either PGlite (dev,
 *  zero-install embedded Postgres) or node-postgres (prod). The choice is
 *  controlled by WAVEX_DB_DRIVER env var ("pglite" | "pg"); default is
 *  "pglite" so `pnpm dev` boots without Docker.
 *
 *  All schema + queries written against this returned drizzle instance work
 *  identically against both drivers — same SQL dialect (Postgres), same
 *  Drizzle API. */
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

export type DbDriver = "pglite" | "pg";

export type Db = ReturnType<typeof drizzlePglite<typeof schema>> | ReturnType<typeof drizzlePostgres<typeof schema>>;

let cached: Db | undefined;

export function getDbDriver(): DbDriver {
  const v = (process.env.WAVEX_DB_DRIVER ?? "").toLowerCase();
  if (v === "pg" || v === "postgres") return "pg";
  return "pglite";
}

export function getDataDir(): string {
  return process.env.WAVEX_DB_DATA_DIR ?? `${process.env.HOME}/.wavex-os/db/pglite`;
}

export async function getDb(): Promise<Db> {
  if (cached) return cached;
  const driver = getDbDriver();
  if (driver === "pg") {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("WAVEX_DB_DRIVER=pg requires DATABASE_URL");
    const client = postgres(url, { max: 10 });
    cached = drizzlePostgres(client, { schema });
    return cached;
  }
  const dir = getDataDir();
  const client = new PGlite(dir);
  cached = drizzlePglite(client, { schema });
  return cached;
}

/** Test-only: drop the cached instance so getDb() re-resolves. */
export function _resetDbCache(): void {
  cached = undefined;
}
