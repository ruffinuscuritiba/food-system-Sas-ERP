-- Migration: add_whatsapp_ai_engine_mode
-- Idempotent via ADD COLUMN IF NOT EXISTS

ALTER TABLE "WhatsappAiSettings"
  ADD COLUMN IF NOT EXISTS "engineMode" TEXT NOT NULL DEFAULT 'FULL_SALES';
