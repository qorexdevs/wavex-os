import { bigint, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const companyKpis = pgTable("company_kpis", {
  companyId: text("company_id").notNull(),
  kpiId: text("kpi_id").notNull(),
  label: text("label").notNull(),
  direction: text("direction").notNull(),
  targetMicros: bigint("target_micros", { mode: "bigint" }),
  windowDays: text("window_days"),
  kpiOwnerAgentId: text("kpi_owner_agent_id"),
  ownerRole: text("owner_role"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const kpiSnapshots = pgTable("kpi_snapshots", {
  companyId: text("company_id").notNull(),
  kpiName: text("kpi_name").notNull(),
  value: bigint("value", { mode: "bigint" }).notNull(),
  measuredAt: timestamp("measured_at", { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb("metadata"),
});

export type CompanyKpi = typeof companyKpis.$inferSelect;
export type KpiSnapshot = typeof kpiSnapshots.$inferSelect;
