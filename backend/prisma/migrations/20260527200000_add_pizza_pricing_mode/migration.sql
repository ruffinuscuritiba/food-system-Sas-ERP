-- AlterTable: add pizzaPricingMode to CompanyTheme
ALTER TABLE "CompanyTheme" ADD COLUMN IF NOT EXISTS "pizzaPricingMode" TEXT NOT NULL DEFAULT 'MAX';
