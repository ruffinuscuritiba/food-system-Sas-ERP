-- Migration: 20260623000000_add_wallet_engine
-- Idempotente: usa IF NOT EXISTS / DO $$ ... $$ para segurança em re-run

-- Campos de split financeiro em OnlineOrder
ALTER TABLE "OnlineOrder"
  ADD COLUMN IF NOT EXISTS "grossAmount" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "feeAmount"   DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "netAmount"   DECIMAL(10,2);

-- Enum WalletTxType
DO $$ BEGIN
  CREATE TYPE "WalletTxType" AS ENUM (
    'ORDER_CREDIT', 'SUBSCRIPTION_DEBIT', 'REPASSE',
    'TRANSFER_FEE', 'MANUAL_CREDIT', 'MANUAL_DEBIT'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Enum RepasseStatus
DO $$ BEGIN
  CREATE TYPE "RepasseStatus" AS ENUM (
    'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tabela WalletRepasse (antes de WalletTransaction por causa da FK)
CREATE TABLE IF NOT EXISTS "WalletRepasse" (
  "id"              TEXT          NOT NULL,
  "companyId"       TEXT          NOT NULL,
  "amount"          DECIMAL(10,2) NOT NULL,
  "transferFee"     DECIMAL(10,2) NOT NULL DEFAULT 1.90,
  "netAmount"       DECIMAL(10,2) NOT NULL,
  "status"          "RepasseStatus" NOT NULL DEFAULT 'PENDING',
  "pixKey"          TEXT,
  "bank"            TEXT,
  "gatewayId"       TEXT,
  "gatewayResponse" JSONB,
  "scheduledFor"    TIMESTAMP(3) NOT NULL,
  "processedAt"     TIMESTAMP(3),
  "failReason"      TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WalletRepasse_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WalletRepasse_companyId_fkey'
  ) THEN
    ALTER TABLE "WalletRepasse"
      ADD CONSTRAINT "WalletRepasse_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "WalletRepasse_companyId_idx"    ON "WalletRepasse"("companyId");
CREATE INDEX IF NOT EXISTS "WalletRepasse_status_idx"       ON "WalletRepasse"("status");
CREATE INDEX IF NOT EXISTS "WalletRepasse_scheduledFor_idx" ON "WalletRepasse"("scheduledFor");

-- Tabela WalletTransaction
CREATE TABLE IF NOT EXISTS "WalletTransaction" (
  "id"            TEXT            NOT NULL,
  "companyId"     TEXT            NOT NULL,
  "type"          "WalletTxType"  NOT NULL,
  "amount"        DECIMAL(10,2)   NOT NULL,
  "balanceBefore" DECIMAL(10,2)   NOT NULL,
  "balanceAfter"  DECIMAL(10,2)   NOT NULL,
  "description"   TEXT            NOT NULL,
  "referenceId"   TEXT,
  "referenceType" TEXT,
  "repasseId"     TEXT,
  "createdAt"     TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WalletTransaction_companyId_fkey'
  ) THEN
    ALTER TABLE "WalletTransaction"
      ADD CONSTRAINT "WalletTransaction_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WalletTransaction_repasseId_fkey'
  ) THEN
    ALTER TABLE "WalletTransaction"
      ADD CONSTRAINT "WalletTransaction_repasseId_fkey"
      FOREIGN KEY ("repasseId") REFERENCES "WalletRepasse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "WalletTransaction_companyId_idx" ON "WalletTransaction"("companyId");
CREATE INDEX IF NOT EXISTS "WalletTransaction_createdAt_idx" ON "WalletTransaction"("createdAt");
CREATE INDEX IF NOT EXISTS "WalletTransaction_repasseId_idx" ON "WalletTransaction"("repasseId");
