-- Product.originalPrice: preço "de" (riscado) quando o produto está em
-- promoção no cardápio digital (idempotente).
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "originalPrice" DECIMAL(10,2);
