-- Ordenação manual das Bordas Recheadas (mover para cima/baixo). Idempotente.
ALTER TABLE "PizzaBorder" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Backfill preservando a ordem visual atual (era exibida por name asc).
-- Filtra sortOrder = 0 para não sobrescrever reordenações manuais já feitas.
UPDATE "PizzaBorder" b
SET    "sortOrder" = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "companyId" ORDER BY "name" ASC, "createdAt" ASC) AS rn
  FROM   "PizzaBorder"
) sub
WHERE  b.id = sub.id
  AND  b."sortOrder" = 0;

CREATE INDEX IF NOT EXISTS "PizzaBorder_companyId_sortOrder_idx" ON "PizzaBorder" ("companyId", "sortOrder");
