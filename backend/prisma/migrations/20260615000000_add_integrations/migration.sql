-- Migration: 20260615000000_add_integrations
-- Idempotente: todos os blocos usam IF NOT EXISTS / DO $$ BEGIN ... EXCEPTION WHEN duplicate_object

-- ── 1. Enum IntegrationProvider ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "IntegrationProvider" AS ENUM ('IFOOD', 'RAPPI', 'MOCK');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. Order: channel + externalOrderId ──────────────────────────────────────
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "channel" TEXT NOT NULL DEFAULT 'PDV';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "externalOrderId" TEXT;

-- Unique index parcial (permite múltiplos NULLs, garante unicidade dos não-nulos)
CREATE UNIQUE INDEX IF NOT EXISTS "Order_externalOrderId_key"
  ON "Order"("externalOrderId")
  WHERE "externalOrderId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "Order_channel_idx" ON "Order"("channel");

-- ── 3. IntegrationConfig ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "IntegrationConfig" (
  "id"              TEXT         NOT NULL,
  "companyId"       TEXT         NOT NULL,
  "provider"        "IntegrationProvider" NOT NULL,
  "isActive"        BOOLEAN      NOT NULL DEFAULT false,
  "sandboxMode"     BOOLEAN      NOT NULL DEFAULT true,
  "apiKeyEncrypted" TEXT,
  "merchantId"      TEXT,
  "webhookSecret"   TEXT,
  "accessToken"     TEXT,
  "refreshToken"    TEXT,
  "tokenExpiresAt"  TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IntegrationConfig_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'IntegrationConfig_companyId_provider_key'
  ) THEN
    ALTER TABLE "IntegrationConfig"
      ADD CONSTRAINT "IntegrationConfig_companyId_provider_key"
      UNIQUE ("companyId", "provider");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'IntegrationConfig_companyId_fkey'
  ) THEN
    ALTER TABLE "IntegrationConfig"
      ADD CONSTRAINT "IntegrationConfig_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "IntegrationConfig_companyId_idx" ON "IntegrationConfig"("companyId");
CREATE INDEX IF NOT EXISTS "IntegrationConfig_provider_idx"  ON "IntegrationConfig"("provider");

-- ── 4. IntegrationOrder ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "IntegrationOrder" (
  "id"              TEXT         NOT NULL,
  "companyId"       TEXT         NOT NULL,
  "configId"        TEXT         NOT NULL,
  "orderId"         TEXT,
  "externalOrderId" TEXT         NOT NULL,
  "provider"        "IntegrationProvider" NOT NULL,
  "externalStatus"  TEXT,
  "ackSentAt"       TIMESTAMP(3),
  "errorMessage"    TEXT,
  "rawPayload"      JSONB,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IntegrationOrder_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'IntegrationOrder_externalOrderId_key'
  ) THEN
    ALTER TABLE "IntegrationOrder"
      ADD CONSTRAINT "IntegrationOrder_externalOrderId_key"
      UNIQUE ("externalOrderId");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'IntegrationOrder_companyId_fkey'
  ) THEN
    ALTER TABLE "IntegrationOrder"
      ADD CONSTRAINT "IntegrationOrder_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'IntegrationOrder_configId_fkey'
  ) THEN
    ALTER TABLE "IntegrationOrder"
      ADD CONSTRAINT "IntegrationOrder_configId_fkey"
      FOREIGN KEY ("configId") REFERENCES "IntegrationConfig"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "IntegrationOrder_companyId_idx"       ON "IntegrationOrder"("companyId");
CREATE INDEX IF NOT EXISTS "IntegrationOrder_externalOrderId_idx" ON "IntegrationOrder"("externalOrderId");
CREATE INDEX IF NOT EXISTS "IntegrationOrder_orderId_idx"         ON "IntegrationOrder"("orderId");

-- ── 5. IntegrationEventLog ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "IntegrationEventLog" (
  "id"              TEXT         NOT NULL,
  "companyId"       TEXT         NOT NULL,
  "provider"        "IntegrationProvider" NOT NULL,
  "eventType"       TEXT         NOT NULL,
  "externalOrderId" TEXT,
  "processedAt"     TIMESTAMP(3),
  "status"          TEXT         NOT NULL DEFAULT 'RECEIVED',
  "errorMessage"    TEXT,
  "rawPayload"      JSONB,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IntegrationEventLog_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'IntegrationEventLog_companyId_fkey'
  ) THEN
    ALTER TABLE "IntegrationEventLog"
      ADD CONSTRAINT "IntegrationEventLog_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "IntegrationEventLog_companyId_idx"       ON "IntegrationEventLog"("companyId");
CREATE INDEX IF NOT EXISTS "IntegrationEventLog_externalOrderId_idx" ON "IntegrationEventLog"("externalOrderId");
CREATE INDEX IF NOT EXISTS "IntegrationEventLog_createdAt_idx"       ON "IntegrationEventLog"("createdAt");

-- ── 6. ProductCatalogMap ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ProductCatalogMap" (
  "id"                TEXT         NOT NULL,
  "companyId"         TEXT         NOT NULL,
  "provider"          "IntegrationProvider" NOT NULL,
  "externalProductId" TEXT         NOT NULL,
  "internalProductId" TEXT         NOT NULL,
  "externalVariantId" TEXT,
  "sizeMapping"       JSONB,
  "isActive"          BOOLEAN      NOT NULL DEFAULT true,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductCatalogMap_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ProductCatalogMap_companyId_provider_externalProductId_key'
  ) THEN
    ALTER TABLE "ProductCatalogMap"
      ADD CONSTRAINT "ProductCatalogMap_companyId_provider_externalProductId_key"
      UNIQUE ("companyId", "provider", "externalProductId");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProductCatalogMap_companyId_fkey'
  ) THEN
    ALTER TABLE "ProductCatalogMap"
      ADD CONSTRAINT "ProductCatalogMap_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProductCatalogMap_internalProductId_fkey'
  ) THEN
    ALTER TABLE "ProductCatalogMap"
      ADD CONSTRAINT "ProductCatalogMap_internalProductId_fkey"
      FOREIGN KEY ("internalProductId") REFERENCES "Product"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ProductCatalogMap_companyId_idx"         ON "ProductCatalogMap"("companyId");
CREATE INDEX IF NOT EXISTS "ProductCatalogMap_internalProductId_idx" ON "ProductCatalogMap"("internalProductId");
