-- Migration: add_menu_time_windows
-- Cardápio por ocasião (Category) + happy hour automático (Product).
-- Idempotente — mesmo padrão ADD COLUMN IF NOT EXISTS já usado no projeto.

ALTER TABLE "Category"
  ADD COLUMN IF NOT EXISTS "availableFrom" TEXT,
  ADD COLUMN IF NOT EXISTS "availableTo" TEXT,
  ADD COLUMN IF NOT EXISTS "availableDays" TEXT;

ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "promoStartTime" TEXT,
  ADD COLUMN IF NOT EXISTS "promoEndTime" TEXT,
  ADD COLUMN IF NOT EXISTS "promoDays" TEXT;
