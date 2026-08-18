-- Migration: add_product_promo_flavor_ids
-- Idempotente — ADD COLUMN IF NOT EXISTS.

ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "promoFlavorIds" JSONB;
