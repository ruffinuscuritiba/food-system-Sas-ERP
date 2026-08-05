-- Cashback por pedido: taxa configurável pela loja + escolha por pedido
-- (acumular vs usar agora). Idempotente.

CREATE TABLE IF NOT EXISTS "CashbackConfig" (
  "id"          TEXT NOT NULL,
  "companyId"   TEXT NOT NULL,
  "ratePercent" DECIMAL(5,2) NOT NULL DEFAULT 1.5,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CashbackConfig_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CashbackConfig_companyId_key'
  ) THEN
    ALTER TABLE "CashbackConfig" ADD CONSTRAINT "CashbackConfig_companyId_key" UNIQUE ("companyId");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CashbackConfig_companyId_fkey') THEN
    ALTER TABLE "CashbackConfig" ADD CONSTRAINT "CashbackConfig_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "OnlineOrder" ADD COLUMN IF NOT EXISTS "instantCashbackApplied" BOOLEAN NOT NULL DEFAULT false;
