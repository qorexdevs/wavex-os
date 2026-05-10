import { bigint, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const issues = pgTable("issues", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull(),
  assigneeAgentId: text("assignee_agent_id"),
  title: text("title").notNull(),
  body: text("body"),
  targetKpi: text("target_kpi"),
  estimatedDelta: bigint("estimated_delta", { mode: "bigint" }),
  baselineSnapshot: jsonb("baseline_snapshot"),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const issueComments = pgTable("issue_comments", {
  id: text("id").primaryKey(),
  issueId: text("issue_id").notNull(),
  authorAgentId: text("author_agent_id"),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const taskOutcomeAttributions = pgTable(
  "task_outcome_attributions",
  {
    id: text("id").primaryKey(),
    issueId: text("issue_id").notNull(),
    companyId: text("company_id").notNull(),
    kpiId: text("kpi_id").notNull(),
    assigneeAgentId: text("assignee_agent_id"),
    baselineValue: bigint("baseline_value", { mode: "bigint" }),
    baselineCapturedAt: timestamp("baseline_captured_at", { withTimezone: true }),
    targetDelta: bigint("target_delta", { mode: "bigint" }),
    actualDelta: bigint("actual_delta", { mode: "bigint" }),
    closingValue: bigint("closing_value", { mode: "bigint" }),
    forecastError: bigint("forecast_error", { mode: "bigint" }),
    attributionMethod: text("attribution_method").notNull(),
    attributedAt: timestamp("attributed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ issueIdUnique: uniqueIndex("task_outcome_attributions_issue_id_uniq").on(t.issueId) }),
);

export type Issue = typeof issues.$inferSelect;
export type TaskOutcomeAttribution = typeof taskOutcomeAttributions.$inferSelect;
