import { boolean, integer, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email"),
  isNewUser: boolean("is_new_user").notNull().default(true),
  wizardStep: integer("wizard_step").notNull().default(1),
  wizardCompletedAt: timestamp("wizard_completed_at", { withTimezone: true }),
  // Referral v1 — set by POST /api/referrals/generate-code
  referralCode: text("referral_code"),
  // Referral v1 — set by POST /api/referrals/dismiss (T+0)
  referralModalDismissedAt: timestamp("referral_modal_dismissed_at", { withTimezone: true }),
  // Referral v1 — set after Email B is successfully sent (T+24h nudge)
  referralEmailBSentAt: timestamp("referral_email_b_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  referralCodeUnique: unique("users_referral_code_unique").on(t.referralCode),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
