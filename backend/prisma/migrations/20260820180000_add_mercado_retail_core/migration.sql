-- Módulo Mercado — Fase 1 (auditoria em docs/MERCADO_RETAIL_CORE.md).
-- 100% aditivo: nenhuma coluna existente muda de tipo/obrigatoriedade de forma
-- destrutiva, nenhum dado é tocado. Idempotente: seguro reaplicar.

-- Product: campos de varejo (peso/PLU/estoque próprio do produto).
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "isWeighted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "pricePerKg" DECIMAL(10,2);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "pluCode" TEXT;
-- SEM default 0 de propósito: NULL = produto nunca configurado pra estoque
-- de varejo (imensa maioria hoje, todo restaurante/pizzaria existente) —
-- só participa do consumo automático (orders.service.ts) quando alguém
-- explicitamente definir um número aqui. "trackStock" já é true por padrão
-- em todo produto (comportamento pré-existente, não usado como gatilho).
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "stock" DECIMAL(10,2);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "minStock" DECIMAL(10,2);

-- StockMovement: ingredientId vira opcional (nenhuma linha existente é
-- afetada — todas já têm ingredientId preenchido); productId novo, opcional.
ALTER TABLE "StockMovement" ALTER COLUMN "ingredientId" DROP NOT NULL;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "productId" TEXT;

DO $$ BEGIN
  ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "StockMovement_productId_idx" ON "StockMovement"("productId");

-- Cash: suporte a múltiplos caixas simultâneos (registerNumber null preserva
-- 100% o comportamento de 1-caixa-por-vez já em produção).
ALTER TABLE "Cash" ADD COLUMN IF NOT EXISTS "registerNumber" INTEGER;
ALTER TABLE "Cash" ADD COLUMN IF NOT EXISTS "terminalName" TEXT;
ALTER TABLE "Cash" ADD COLUMN IF NOT EXISTS "openedByUserId" TEXT;
ALTER TABLE "Cash" ADD COLUMN IF NOT EXISTS "openedByName" TEXT;

CREATE INDEX IF NOT EXISTS "Cash_companyId_registerNumber_isOpen_idx"
  ON "Cash"("companyId", "registerNumber", "isOpen");
