-- Add enums
DO $$ BEGIN
  CREATE TYPE "ModuleCategory" AS ENUM ('OPERACAO', 'MARKETING', 'FINANCEIRO', 'AUTOMACAO');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "ModuleStatus" AS ENUM ('TRIAL', 'ACTIVE', 'INACTIVE', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Create Module catalog table
CREATE TABLE IF NOT EXISTS "Module" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "longDescription" TEXT,
    "icon" TEXT NOT NULL,
    "category" "ModuleCategory" NOT NULL,
    "price" DECIMAL(10,2),
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    "badge" TEXT,
    "badgeColor" TEXT,
    "benefits" TEXT[] DEFAULT '{}',
    "isHighlighted" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Module_slug_key" ON "Module"("slug");
CREATE INDEX IF NOT EXISTS "Module_category_idx" ON "Module"("category");
CREATE INDEX IF NOT EXISTS "Module_slug_idx" ON "Module"("slug");

-- Update CompanyModule with new fields
ALTER TABLE "CompanyModule" ADD COLUMN IF NOT EXISTS "moduleSlug" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CompanyModule" ADD COLUMN IF NOT EXISTS "status" "ModuleStatus" NOT NULL DEFAULT 'INACTIVE';
ALTER TABLE "CompanyModule" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3);
ALTER TABLE "CompanyModule" ADD COLUMN IF NOT EXISTS "activatedAt" TIMESTAMP(3);
ALTER TABLE "CompanyModule" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill moduleSlug and status from legacy columns
UPDATE "CompanyModule"
SET
  "moduleSlug" = LOWER("module"),
  "status" = CASE WHEN "active" = true THEN 'ACTIVE'::"ModuleStatus" ELSE 'INACTIVE'::"ModuleStatus" END,
  "activatedAt" = CASE WHEN "active" = true THEN "createdAt" ELSE NULL END
WHERE "moduleSlug" = '';

CREATE INDEX IF NOT EXISTS "CompanyModule_moduleSlug_idx" ON "CompanyModule"("moduleSlug");
