-- Zoom da imagem do produto (30-150%, default 100). Idempotente.
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "imageZoom" INTEGER NOT NULL DEFAULT 100;
