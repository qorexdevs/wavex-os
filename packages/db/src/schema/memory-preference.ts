/** Avatar memory v1 — distilled preference rules.
 *
 * Output of a periodic T2 pass over memory_episodic. Each row is a
 * short rule like "no apologizing in drafts" or "VIP: sarah@accel"
 * with the supporting event ids that produced it. The runner loads
 * these rows and prepends them to the classifier prompt as hard
 * constraints.
 *
 * Scaffolded but unrun in dev — dev writes to JSONL files at
 * avatars/<id>/memory/preferences.jsonl.
 */

import { integer, jsonb, pgTable, real, text, timestamp } from "drizzle-orm/pg-core";

export const memoryPreference = pgTable("memory_preference", {
  id: text("id").primaryKey(),
  avatarId: text("avatar_id").notNull(),
  rule: text("rule").notNull(),
  category: text("category").notNull(),         // "tone" | "vip" | "privacy" | "delegate" | "other"
  confidence: real("confidence").notNull(),
  learnedAt: timestamp("learned_at", { withTimezone: true }).notNull().defaultNow(),
  retiredAt: timestamp("retired_at", { withTimezone: true }),
  supportingEventIds: jsonb("supporting_event_ids").$type<string[]>().notNull().default([]),
  applyCount: integer("apply_count").notNull().default(0),
});

export type MemoryPreferenceRow = typeof memoryPreference.$inferSelect;
export type NewMemoryPreferenceRow = typeof memoryPreference.$inferInsert;
