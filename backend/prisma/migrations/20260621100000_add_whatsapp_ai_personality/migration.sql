-- Migration: add_whatsapp_ai_personality
-- Idempotent via ADD COLUMN IF NOT EXISTS

ALTER TABLE "WhatsappAiSettings"
  ADD COLUMN IF NOT EXISTS "responseStyle"       TEXT    NOT NULL DEFAULT 'DIRECT',
  ADD COLUMN IF NOT EXISTS "personalityType"     TEXT    NOT NULL DEFAULT 'FRIENDLY',
  ADD COLUMN IF NOT EXISTS "emojiUsage"          TEXT    NOT NULL DEFAULT 'MODERATE',
  ADD COLUMN IF NOT EXISTS "advancedPersonality" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "speechHabits"        TEXT,
  ADD COLUMN IF NOT EXISTS "characteristics"     TEXT,
  ADD COLUMN IF NOT EXISTS "principles"          TEXT,
  ADD COLUMN IF NOT EXISTS "humor"               TEXT,
  ADD COLUMN IF NOT EXISTS "menuLinkStyle"        TEXT    NOT NULL DEFAULT 'BUTTON',
  ADD COLUMN IF NOT EXISTS "conversationalOrdering" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "orderHandlingMode"   TEXT    NOT NULL DEFAULT 'LINK_ONLY';
