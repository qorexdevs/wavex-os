-- Referral v1 columns on users (WAVAAAA-106 / WAVAAAA-81)
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "email" text,
  ADD COLUMN IF NOT EXISTS "referral_code" text,
  ADD COLUMN IF NOT EXISTS "referral_modal_dismissed_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "referral_email_b_sent_at" timestamp with time zone;

CREATE UNIQUE INDEX IF NOT EXISTS "users_referral_code_unique"
  ON "users" ("referral_code")
  WHERE "referral_code" IS NOT NULL;
