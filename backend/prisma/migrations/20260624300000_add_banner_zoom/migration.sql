-- Idempotent: adiciona zoom do banner da categoria (30–150, default 100 = cover)
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "bannerImageZoom" INTEGER NOT NULL DEFAULT 100;
