/** Avatar memory v1 — semantic memory chunks.
 *
 * Free-form facts the avatar has learned ("Sarah Lin is at Accel, lead
 * investor since Series A", "Stripe digest emails are weekly on Tue").
 * Vector column is pgvector when cloud Postgres lands; on PGlite +
 * JSONL fallback the runner orders by recency only.
 *
 * Scaffolded but unrun in dev.
 */

import { jsonb, pgTable, real, text, timestamp } from "drizzle-orm/pg-core";

export const memorySemantic = pgTable("memory_semantic", {
  id: text("id").primaryKey(),
  avatarId: text("avatar_id").notNull(),
  chunk: text("chunk").notNull(),
  source: text("source").notNull(),              // "episodic_distill" | "tool_meta" | "demo_capture"
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  decay: real("decay").notNull().default(1.0),
  // `embedding` is a pgvector(1536) column when the cloud migration runs.
  // We keep the JSON shape unstructured here so the migration can swap
  // the column type without breaking the row schema in dev.
  embedding: jsonb("embedding").$type<number[] | null>(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
});

export type MemorySemanticRow = typeof memorySemantic.$inferSelect;
export type NewMemorySemanticRow = typeof memorySemantic.$inferInsert;
