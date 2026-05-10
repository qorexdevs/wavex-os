import { boolean, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const agents = pgTable("agents", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  slot: text("slot").notNull(),
  templateId: text("template_id"),
  reportsToAgentId: text("reports_to_agent_id"),
  reportsToSlot: text("reports_to_slot"),
  tier: integer("tier").notNull().default(3),
  status: text("status").notNull().default("ready"),
  adapter: text("adapter").notNull().default("claude-code"),
  model: text("model").notNull().default("claude-sonnet-4-6"),
  heartbeat: text("heartbeat"),
  spawnable: boolean("spawnable").notNull().default(true),
  ownedKpiIds: jsonb("owned_kpi_ids").$type<string[]>().notNull().default([]),
  spawnedAt: timestamp("spawned_at", { withTimezone: true }).notNull().defaultNow(),
});

export const heartbeatRuns = pgTable("heartbeat_runs", {
  agentId: text("agent_id").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  status: text("status").notNull(),
});

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
