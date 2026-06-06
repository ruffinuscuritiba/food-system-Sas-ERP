-- Migration: add_wa_clicked_at
-- Idempotent: ADD COLUMN IF NOT EXISTS

ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "waClickedAt" TIMESTAMP(3);
