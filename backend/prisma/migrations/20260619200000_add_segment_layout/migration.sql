-- Migration: add businessSegment, layoutType, buttonRadius to Company (idempotent)
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "businessSegment" TEXT NOT NULL DEFAULT 'RESTAURANTE';
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "layoutType" TEXT NOT NULL DEFAULT 'LIST';
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "buttonRadius" TEXT NOT NULL DEFAULT 'MD';
