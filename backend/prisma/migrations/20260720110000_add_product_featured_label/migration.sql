-- Product.featuredLabel: rótulo do card no cardápio digital
-- (null | "DESTAQUE" | "NOVIDADE" | "RECOMENDADO") — idempotente.
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "featuredLabel" TEXT;
