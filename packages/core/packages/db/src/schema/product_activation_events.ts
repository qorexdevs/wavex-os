import { sql } from "drizzle-orm";
import { pgTable, pgSchema, uuid, text, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";

const wavexOsSchema = pgSchema("wavex_os");

export type ProductActivationEventType =
  | "user_signed_up"
  | "repo_connected"
  | "test_run_started"
  | "test_run_completed"
  | "user_activated";

export type UserSignedUpPayload = { source: string };
export type RepoConnectedPayload = { repo: string; connector_version: string };
export type TestRunStartedPayload = { run_id: string; repo: string; platform: string };
export type TestRunCompletedPayload = { run_id: string; status: string; duration_s: number; platform?: string };
export type UserActivatedPayload = { hours_since_signup: number; trigger_run_id: string };

export type ProductActivationEventPayload =
  | UserSignedUpPayload
  | RepoConnectedPayload
  | TestRunStartedPayload
  | TestRunCompletedPayload
  | UserActivatedPayload;

export const productActivationEvents = wavexOsSchema.table(
  "product_activation_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: text("company_id").notNull(),
    userId: text("user_id").notNull(),
    eventType: text("event_type").$type<ProductActivationEventType>().notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    payload: jsonb("payload").$type<ProductActivationEventPayload>().notNull().default({} as ProductActivationEventPayload),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyUserIdx: index("product_activation_events_company_user_idx").on(
      table.companyId,
      table.userId,
      table.occurredAt,
    ),
    eventTypeIdx: index("product_activation_events_event_type_idx").on(
      table.eventType,
      table.occurredAt,
    ),
    userActivatedOnceIdx: uniqueIndex("product_activation_events_user_activated_once_idx")
      .on(table.companyId, table.userId)
      .where(sql`${table.eventType} = 'user_activated'`),
  }),
);
