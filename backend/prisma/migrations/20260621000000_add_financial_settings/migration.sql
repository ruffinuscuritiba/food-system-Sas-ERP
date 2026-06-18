-- Migration: add_financial_settings
-- Idempotent via ADD COLUMN IF NOT EXISTS

ALTER TABLE "Company"
  ADD COLUMN IF NOT EXISTS "repasseFrequency"  TEXT    NOT NULL DEFAULT 'DAILY',
  ADD COLUMN IF NOT EXISTS "repasseTime"        TEXT    NOT NULL DEFAULT '03:00',
  ADD COLUMN IF NOT EXISTS "repasseWeekday"     INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "creditReleasePlan"  TEXT    NOT NULL DEFAULT 'D30',
  ADD COLUMN IF NOT EXISTS "bankAccountData"    JSONB,
  ADD COLUMN IF NOT EXISTS "walletBalance"      DECIMAL(10,2) NOT NULL DEFAULT 0;
