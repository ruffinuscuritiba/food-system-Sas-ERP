-- White Label Theme Engine — Fase 1 + Fase 4
-- Migration idempotente: ADD COLUMN IF NOT EXISTS em CompanyTheme e Category

-- ─── CompanyTheme: novos campos ──────────────────────────────────────────────
ALTER TABLE "CompanyTheme" ADD COLUMN IF NOT EXISTS "accentColor"  TEXT NOT NULL DEFAULT '#f97316';
ALTER TABLE "CompanyTheme" ADD COLUMN IF NOT EXISTS "faviconUrl"   TEXT;
ALTER TABLE "CompanyTheme" ADD COLUMN IF NOT EXISTS "fontFamily"   TEXT NOT NULL DEFAULT 'Inter';
ALTER TABLE "CompanyTheme" ADD COLUMN IF NOT EXISTS "borderRadius" INTEGER NOT NULL DEFAULT 16;
ALTER TABLE "CompanyTheme" ADD COLUMN IF NOT EXISTS "pdvStyle"     TEXT NOT NULL DEFAULT 'dark';

-- ─── Category: banner dinâmico (Fase 5) ──────────────────────────────────────
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "bannerImage" TEXT;
