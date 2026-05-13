/** Avatar memory v1 — distilled preference rules (JSONL).
 *
 * The runner's classifier prompt reads these rules and prepends them
 * as hard constraints. The distiller (a T2 pass over episodic events
 * since the last distill) is what produces them.
 *
 * Storage: ~/.wavex-os/instances/default/avatars/<id>/memory/preferences.jsonl
 *
 * Each line is a JSON object matching the memoryPreference Drizzle row
 * shape so the cloud migration is a straight INSERT loop.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { randomBytes } from "node:crypto";
import { route as tierRoute } from "@op-omega/plugin-tier-router";
import { withTokenAccounting } from "../../lib/token-accounting.js";
import { readEpisodic } from "./episodic.js";

export type PreferenceCategory = "tone" | "vip" | "privacy" | "delegate" | "other";

export interface PreferenceRule {
  id: string;
  avatarId: string;
  rule: string;
  category: PreferenceCategory;
  confidence: number;
  learnedAt: string;
  retiredAt?: string;
  supportingEventIds: string[];
  applyCount: number;
}

function avatarDir(id: string): string {
  const root = process.env.WAVEX_OS_STATE_DIR ?? join(homedir(), ".wavex-os");
  return join(root, "instances", "default", "avatars", id);
}

function preferencesPath(avatarId: string): string {
  return join(avatarDir(avatarId), "memory", "preferences.jsonl");
}

function newPreferenceId(): string {
  return `pref_${randomBytes(8).toString("hex")}`;
}

export async function readPreferences(avatarId: string): Promise<PreferenceRule[]> {
  let raw: string;
  try {
    raw = await readFile(preferencesPath(avatarId), "utf8");
  } catch {
    return [];
  }
  const out: PreferenceRule[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const p = JSON.parse(line) as PreferenceRule;
      if (!p.retiredAt) out.push(p);
    } catch { /* skip malformed lines */ }
  }
  return out;
}

/** Overwrites the whole file with the given rules. The distiller calls
 *  this after merging old + new — preferences.jsonl is small enough
 *  (likely < 100 rules ever) that we don't bother with append-only
 *  semantics; whole-file write makes retire / dedupe trivial. */
async function writeAll(avatarId: string, rules: PreferenceRule[]): Promise<void> {
  const path = preferencesPath(avatarId);
  await mkdir(join(avatarDir(avatarId), "memory"), { recursive: true });
  await writeFile(path, rules.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");
}

/** Run a T2 pass over recent episodic events and produce 1-5 new rules.
 *  Idempotent — re-runs merge with existing rules by exact `rule` text.
 *  Returns the rules that were newly added (for UI feedback). */
export async function distillPreferences(
  avatarId: string,
  opts: { skipInference?: boolean; lookbackHours?: number } = {},
): Promise<PreferenceRule[]> {
  const skipInference = opts.skipInference ?? false;
  const lookbackMs = (opts.lookbackHours ?? 24 * 7) * 60 * 60 * 1000;
  const since = new Date(Date.now() - lookbackMs).toISOString();
  const events = await readEpisodic(avatarId, since);
  if (events.length === 0) return [];

  const existing = await readPreferences(avatarId);
  const existingTexts = new Set(existing.map((r) => r.rule.toLowerCase().trim()));

  if (skipInference) {
    // Deterministic fallback: count edits → "no apologizing" heuristic
    // when ≥2 edits remove "sorry" / "apolog" tokens.
    const apologiesRemoved = events.filter((e) =>
      e.kind === "edit"
      && /sorry|apolog/i.test(e.edited?.before ?? "")
      && !/sorry|apolog/i.test(e.edited?.after ?? ""),
    );
    if (apologiesRemoved.length < 2) return [];
    const rule = "Never apologize in drafts — operator consistently removes apology language";
    if (existingTexts.has(rule.toLowerCase().trim())) return [];
    const added: PreferenceRule = {
      id: newPreferenceId(),
      avatarId,
      rule,
      category: "tone",
      confidence: 0.7,
      learnedAt: new Date().toISOString(),
      supportingEventIds: apologiesRemoved.map((e) => e.id),
      applyCount: 0,
    };
    await writeAll(avatarId, [...existing, added]);
    return [added];
  }

  const eventsBrief = events.slice(-30).map((e) => {
    if (e.kind === "edit") {
      return `EDIT(${e.id}) before="${(e.edited?.before ?? "").slice(0, 120)}" after="${(e.edited?.after ?? "").slice(0, 120)}"`;
    }
    return `${e.kind.toUpperCase()}(${e.id}) ${e.decision ?? ""} class=${e.classification ?? "?"} conf=${e.confidence ?? "?"}`;
  }).join("\n");

  const prompt = `You distill operator preferences for a personal AI avatar.

Existing rules (do not duplicate):
${existing.length === 0 ? "(none)" : existing.map((r) => `- ${r.rule}`).join("\n")}

Recent operator events (newest last):
${eventsBrief}

Produce 0-5 NEW rules that capture patterns in the events. Each rule should be:
- short, declarative, actionable (the runner injects it into the classifier prompt as a constraint)
- specific enough to be useful, general enough to apply to future drafts
- backed by ≥2 supporting events

Return JSON only:
{
  "rules": [
    {
      "rule": "<short imperative sentence>",
      "category": "tone" | "vip" | "privacy" | "delegate" | "other",
      "confidence": 0.0-1.0,
      "supporting_event_ids": ["<id>", ...]
    }
  ]
}

If nothing reliable can be distilled, return { "rules": [] }.`;

  let text: string;
  try {
    text = await withTokenAccounting(avatarId, "avatar_memory_distill", async () => {
      const resp = await tierRoute({
        agent_id: "avatar.memory.distill",
        prompt,
        task_metadata: {
          creativity_required: false,
          customer_facing: false,
          reasoning_depth: "shallow",
          priority: "batch",
        },
        companyId: avatarId,
        outputFormat: "json",
        timeout_ms: 30_000,
      });
      return resp.output.trim();
    });
  } catch {
    return [];
  }

  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  let parsed: { rules?: Array<{ rule: string; category?: PreferenceCategory; confidence?: number; supporting_event_ids?: string[] }> };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return [];
  }

  const added: PreferenceRule[] = [];
  for (const r of parsed.rules ?? []) {
    const text = r.rule?.trim();
    if (!text) continue;
    if (existingTexts.has(text.toLowerCase())) continue;
    added.push({
      id: newPreferenceId(),
      avatarId,
      rule: text,
      category: r.category ?? "other",
      confidence: typeof r.confidence === "number" ? r.confidence : 0.6,
      learnedAt: new Date().toISOString(),
      supportingEventIds: Array.isArray(r.supporting_event_ids) ? r.supporting_event_ids : [],
      applyCount: 0,
    });
  }
  if (added.length === 0) return [];
  await writeAll(avatarId, [...existing, ...added]);
  return added;
}
