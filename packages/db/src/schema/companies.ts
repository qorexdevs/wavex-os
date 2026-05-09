import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const companies = pgTable("companies", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  industry: text("industry"),
  ownerUserId: text("owner_user_id"),
  state: text("state").notNull().default("draft"),
  pillarResponses: jsonb("pillar_responses"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
