-- (1) Pesquisa de satisfação formal — nota 1-5 na resposta de feedback pós-entrega.
-- (2) Vendas Recorrentes — pacotes/assinaturas com cobrança por ciclo, reaproveitando
--     100% o pipeline de OnlineOrder+PIX já existente.
-- Idempotente: seguro reaplicar.

ALTER TABLE "DeliveryFeedback" ADD COLUMN IF NOT EXISTS "rating" INTEGER;

DO $$ BEGIN
  CREATE TYPE "PackageBillingCycle" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PackageSubscriptionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PackageBillingStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "SalesPackage" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "billingCycle" "PackageBillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "includedItems" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesPackage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PackageSubscription" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerName" TEXT,
    "status" "PackageSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextBillingAt" TIMESTAMP(3) NOT NULL,
    "pausedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackageSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PackageBilling" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "cycleNumber" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "PackageBillingStatus" NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "onlineOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackageBilling_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SalesPackage_companyId_idx" ON "SalesPackage"("companyId");
CREATE INDEX IF NOT EXISTS "SalesPackage_companyId_isActive_idx" ON "SalesPackage"("companyId", "isActive");

CREATE INDEX IF NOT EXISTS "PackageSubscription_companyId_idx" ON "PackageSubscription"("companyId");
CREATE INDEX IF NOT EXISTS "PackageSubscription_companyId_status_idx" ON "PackageSubscription"("companyId", "status");
CREATE INDEX IF NOT EXISTS "PackageSubscription_status_nextBillingAt_idx" ON "PackageSubscription"("status", "nextBillingAt");
CREATE INDEX IF NOT EXISTS "PackageSubscription_companyId_customerPhone_idx" ON "PackageSubscription"("companyId", "customerPhone");

CREATE INDEX IF NOT EXISTS "PackageBilling_companyId_idx" ON "PackageBilling"("companyId");
CREATE INDEX IF NOT EXISTS "PackageBilling_subscriptionId_idx" ON "PackageBilling"("subscriptionId");
CREATE INDEX IF NOT EXISTS "PackageBilling_status_idx" ON "PackageBilling"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "PackageBilling_onlineOrderId_key" ON "PackageBilling"("onlineOrderId");

DO $$ BEGIN
  ALTER TABLE "SalesPackage" ADD CONSTRAINT "SalesPackage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PackageSubscription" ADD CONSTRAINT "PackageSubscription_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PackageSubscription" ADD CONSTRAINT "PackageSubscription_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "SalesPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PackageBilling" ADD CONSTRAINT "PackageBilling_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PackageBilling" ADD CONSTRAINT "PackageBilling_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "PackageSubscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
