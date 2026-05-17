-- Wizard step persistence for 3-step onboarding shell (WAVAAAA-48)
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "wizard_step" integer NOT NULL DEFAULT 1;
