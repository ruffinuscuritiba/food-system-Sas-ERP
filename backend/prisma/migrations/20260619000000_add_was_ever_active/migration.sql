-- Migration: add wasEverActive to Company (idempotent)
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "wasEverActive" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: mark already-active companies as wasEverActive=true
UPDATE "Company" SET "wasEverActive" = true WHERE "subscriptionStatus" = 'ACTIVE';
