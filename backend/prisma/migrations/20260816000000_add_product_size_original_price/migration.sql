-- Migration: add_product_size_original_price
-- Idempotent via ADD COLUMN IF NOT EXISTS

ALTER TABLE "ProductSize"
  ADD COLUMN IF NOT EXISTS "originalPrice" DECIMAL(10,2);
