import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const credentials = pgTable("credentials", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull(),
  connectorId: text("connector_id").notNull(),
  key: text("key").notNull(),
  ciphertext: text("ciphertext").notNull(),
  iv: text("iv").notNull(),
  authTag: text("auth_tag").notNull(),
  salt: text("salt").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  rotatedAt: timestamp("rotated_at", { withTimezone: true }),
});

export const credentialAuditLog = pgTable("credential_audit_log", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull(),
  connectorId: text("connector_id").notNull(),
  action: text("action").notNull(),
  actorAgentId: text("actor_agent_id"),
  metadata: jsonb("metadata"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Credential = typeof credentials.$inferSelect;
export type NewCredential = typeof credentials.$inferInsert;
