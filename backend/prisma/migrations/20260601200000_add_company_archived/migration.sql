-- Migration: add_company_archived
-- Adds archivedAt to Company. Idempotent via ADD COLUMN IF NOT EXISTS.

ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
