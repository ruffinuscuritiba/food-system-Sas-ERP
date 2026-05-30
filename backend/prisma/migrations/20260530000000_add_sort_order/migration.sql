-- Item 3: ordenação manual de Categorias e Produtos + flag de destaque
-- Migration idempotente (segura para re-run)

-- ─── 1. Colunas ──────────────────────────────────────────────────────────────
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "sortOrder"  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Product"  ADD COLUMN IF NOT EXISTS "sortOrder"  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Product"  ADD COLUMN IF NOT EXISTS "isFeatured" BOOLEAN NOT NULL DEFAULT FALSE;

-- ─── 2. Backfill preservando ordem visual atual ──────────────────────────────
-- Categorias eram exibidas por name asc → numera por name asc.
-- Produtos no cardápio digital eram exibidos por name asc → numera por name asc.
-- Filtra sortOrder = 0 para não sobrescrever valores já manualmente reordenados.

UPDATE "Category" c
SET    "sortOrder" = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "companyId" ORDER BY "name" ASC, "createdAt" ASC) AS rn
  FROM   "Category"
) sub
WHERE  c.id = sub.id
  AND  c."sortOrder" = 0;

UPDATE "Product" p
SET    "sortOrder" = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "companyId" ORDER BY "name" ASC, "createdAt" ASC) AS rn
  FROM   "Product"
) sub
WHERE  p.id = sub.id
  AND  p."sortOrder" = 0;

-- ─── 3. Índices compostos (idempotentes) ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS "Category_companyId_sortOrder_idx" ON "Category" ("companyId", "sortOrder");
CREATE INDEX IF NOT EXISTS "Product_companyId_sortOrder_idx"  ON "Product"  ("companyId", "sortOrder");
