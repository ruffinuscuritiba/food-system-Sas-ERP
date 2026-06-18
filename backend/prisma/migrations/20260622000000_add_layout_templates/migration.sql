-- Migration: add_layout_templates
-- Idempotent: ADD COLUMN IF NOT EXISTS + CREATE TABLE IF NOT EXISTS

ALTER TABLE "Company"
  ADD COLUMN IF NOT EXISTS "layoutConfig"    JSONB,
  ADD COLUMN IF NOT EXISTS "googleReviewUrl" TEXT;

CREATE TABLE IF NOT EXISTS "LayoutTemplate" (
  "id"        TEXT        NOT NULL,
  "name"      TEXT        NOT NULL,
  "segment"   TEXT        NOT NULL DEFAULT 'CUSTOM',
  "config"    JSONB       NOT NULL,
  "isDefault" BOOLEAN     NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LayoutTemplate_pkey" PRIMARY KEY ("id")
);
