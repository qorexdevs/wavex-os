/**
 * Re-export of `drizzle-orm`'s `sql` tagged template, BUT importable
 * lazily so the @wavex-os/observability package doesn't hard-depend on
 * Drizzle. If you're using a different driver, replace this with your
 * own tagged-template helper that produces the shape your `db.execute`
 * accepts.
 */
type SqlTag = (strings: TemplateStringsArray, ...values: unknown[]) => unknown;

let _sql: SqlTag | null = null;

async function loadSql(): Promise<SqlTag> {
  if (_sql) return _sql;
  try {
    const mod = (await import("drizzle-orm")) as { sql: SqlTag };
    _sql = mod.sql;
    return _sql;
  } catch {
    throw new Error(
      "[@wavex-os/observability] Could not load `drizzle-orm`. Either install it as a peer dep, " +
        'or replace the import in `src/sql-tag.ts` with your driver\'s tagged-template helper.',
    );
  }
}

// Synchronous facade so call sites remain `sql\`…\``. The first call kicks off
// the async load. If the dynamic load hasn't resolved yet, throw — DB calls
// shouldn't happen during the same microtask as `import("./bottlenecks.js")`.
export const sql: SqlTag = (strings, ...values) => {
  if (!_sql) {
    // eagerly start the load so subsequent calls work
    void loadSql();
    throw new Error(
      "[@wavex-os/observability] sql tag used before drizzle-orm finished loading. " +
        "Call `await preloadSqlTag()` once during startup before invoking DB-bound services.",
    );
  }
  return _sql(strings, ...values);
};

export async function preloadSqlTag(): Promise<void> {
  await loadSql();
}
