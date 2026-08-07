-- Carrinho compartilhado por mesa (pedido em grupo no cardápio digital).
-- Idempotente.

CREATE TABLE IF NOT EXISTS "TableCart" (
  "id"          TEXT NOT NULL,
  "companyId"   TEXT NOT NULL,
  "tableNumber" TEXT NOT NULL,
  "items"       JSONB NOT NULL DEFAULT '[]',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TableCart_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TableCart_companyId_tableNumber_key'
  ) THEN
    ALTER TABLE "TableCart" ADD CONSTRAINT "TableCart_companyId_tableNumber_key" UNIQUE ("companyId", "tableNumber");
  END IF;
END $$;
