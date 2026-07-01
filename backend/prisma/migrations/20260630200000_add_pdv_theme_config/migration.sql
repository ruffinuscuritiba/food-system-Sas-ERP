-- Migration idempotente: adiciona pdvThemeConfig (JSON) ao CompanyTheme
ALTER TABLE "CompanyTheme" ADD COLUMN IF NOT EXISTS "pdvThemeConfig" JSONB;
