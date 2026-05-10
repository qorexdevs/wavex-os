import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const costEvents = pgTable("cost_events", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull(),
  agentId: text("agent_id"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  cachedInputTokens: integer("cached_input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  reasonTag: text("reason_tag"),
});

export type CostEvent = typeof costEvents.$inferSelect;
export type NewCostEvent = typeof costEvents.$inferInsert;
