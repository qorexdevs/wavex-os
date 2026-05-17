/**
 * Guards for the surface-tuning registry:
 *   1. Every entry has a unique id.
 *   2. Every `// @tunable <id>` comment in the plugin source has a
 *      corresponding registry entry, and every registry entry has at least
 *      one annotation site.
 */

import { describe, expect, it } from "vitest";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TUNABLES } from "./registry.js";

const here = resolve(fileURLToPath(import.meta.url), "..");
const phasesRoot = resolve(here, "..", "phases");

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir);
  const out: string[] = [];
  for (const name of entries) {
    const p = join(dir, name);
    const s = await stat(p);
    if (s.isDirectory()) out.push(...(await walk(p)));
    else if (p.endsWith(".ts") && !p.endsWith(".test.ts")) out.push(p);
  }
  return out;
}

async function collectAnnotatedIds(): Promise<Set<string>> {
  const files = await walk(phasesRoot);
  const ids = new Set<string>();
  for (const f of files) {
    const text = await readFile(f, "utf8");
    const matches = text.matchAll(/@tunable\s+([a-z0-9._]+)/g);
    for (const m of matches) ids.add(m[1]);
  }
  return ids;
}

describe("surface tuning registry", () => {
  it("has unique ids", () => {
    const ids = TUNABLES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has non-empty description + currentValue for every entry", () => {
    for (const t of TUNABLES) {
      expect(t.description.length, `${t.id}.description`).toBeGreaterThan(0);
      expect(t.currentValue.length, `${t.id}.currentValue`).toBeGreaterThan(0);
    }
  });

  it("every registry entry is annotated in source", async () => {
    const annotated = await collectAnnotatedIds();
    const missing = TUNABLES.map((t) => t.id).filter((id) => !annotated.has(id));
    expect(missing).toEqual([]);
  });

  it("every source annotation has a registry entry", async () => {
    const annotated = await collectAnnotatedIds();
    const registryIds = new Set(TUNABLES.map((t) => t.id));
    const orphans = [...annotated].filter((id) => !registryIds.has(id));
    expect(orphans).toEqual([]);
  });
});
