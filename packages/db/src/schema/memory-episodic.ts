/** Avatar memory v1 — episodic events.
 *
 * Append-only stream of every operator decision on an avatar's approvals
 * (approve / reject / edit). The runner reads this when distilling
 * preferences and when surfacing recent corrections to the classifier.
 *
 * Scaffolded but unrun in dev — dev writes to JSONL files under
 * avatars/<id>/memory/episodic.jsonl. Migration runs once cloud Postgres
 * lands and the runner's read path switches to DB-backed queries.
 */

import { jsonb, pgTable, real, text, timestamp } from "drizzle-orm/pg-core";

export const memoryEpisodic = pgTable("memory_episodic", {
  id: text("id").primaryKey(),
  avatarId: text("avatar_id").notNull(),
  ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
  kind: text("kind").notNull(),                  // "decision" | "edit" | "skip"
  approvalId: text("approval_id"),
  approvalType: text("approval_type"),           // e.g. "avatar.gmail.draft_reply"
  classification: text("classification"),         // "now" | "soon" | "fyi" | null
  confidence: real("confidence"),
  decision: text("decision"),                     // "approve" | "reject" | null
  edited: jsonb("edited").$type<{ before?: string; after?: string }>(),
  note: text("note"),
  payloadSnapshot: jsonb("payload_snapshot").$type<Record<string, unknown>>(),
});

export type MemoryEpisodicRow = typeof memoryEpisodic.$inferSelect;
export type NewMemoryEpisodicRow = typeof memoryEpisodic.$inferInsert;
