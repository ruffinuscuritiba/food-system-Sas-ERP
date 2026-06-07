-- Migration: add_order_number_enum_indexes
-- Idempotente: usa ADD COLUMN IF NOT EXISTS, USING cast, CREATE INDEX CONCURRENTLY IF NOT EXISTS

-- 1. Número sequencial por tenant
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "number" INTEGER NOT NULL DEFAULT 0;

-- 2. Converter orderType de TEXT para enum OrderType
--    O enum já existe no PostgreSQL (criado pela OnlineOrder). Só cast a coluna.
DO $$
BEGIN
  -- Só executa se a coluna ainda for TEXT (evita erro em rerun)
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'Order'
      AND column_name = 'orderType'
      AND data_type = 'text'
  ) THEN
    -- Garante que os valores existentes são válidos antes do cast
    UPDATE "Order"
    SET "orderType" = 'DINE_IN'
    WHERE "orderType" NOT IN ('DELIVERY', 'DINE_IN', 'PICKUP');

    -- Drop default antes do cast (PostgreSQL não faz cast automático de DEFAULT text→enum)
    ALTER TABLE "Order" ALTER COLUMN "orderType" DROP DEFAULT;

    ALTER TABLE "Order"
      ALTER COLUMN "orderType" TYPE "OrderType"
      USING "orderType"::"OrderType";

    -- Restaura o default como enum
    ALTER TABLE "Order" ALTER COLUMN "orderType" SET DEFAULT 'DINE_IN'::"OrderType";
  END IF;
END
$$;

-- 3. Índices compostos (CONCURRENTLY não funciona dentro de bloco de transação,
--    mas em produção/Render o migrate deploy roda fora de transação explícita)
CREATE INDEX IF NOT EXISTS "Order_companyId_status_idx" ON "Order"("companyId", "status");
CREATE INDEX IF NOT EXISTS "Order_companyId_createdAt_idx" ON "Order"("companyId", "createdAt");
