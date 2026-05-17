-- Wizard repo selection for QA onboarding wizard step 1 (WAVAAAA-51)
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "wizard_repo" text;
