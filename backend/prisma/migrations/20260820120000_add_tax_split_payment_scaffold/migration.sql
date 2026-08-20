-- Split Payment / IBS-CBS (Reforma Tributária do Consumo) — estrutura pronta,
-- inerte por padrão (TaxConfiguration.isActive=false, ver schema.prisma).
-- Idempotente: seguro reaplicar (ex: banco local já parcialmente sincronizado).

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "FiscalOperationStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'PROCESSING', 'CALCULATED', 'SETTLED', 'PARTIALLY_SETTLED', 'FAILED', 'REVERSED', 'REFUNDED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "FiscalSaleChannel" AS ENUM ('OWN_SALE', 'MARKETPLACE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "TaxConfiguration" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "appliesToOwnSales" BOOLEAN NOT NULL DEFAULT true,
    "appliesToMarketplace" BOOLEAN NOT NULL DEFAULT true,
    "regime" TEXT,
    "ibsRate" DECIMAL(6,4),
    "cbsRate" DECIMAL(6,4),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TaxTransaction" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "channel" "FiscalSaleChannel" NOT NULL,
    "orderId" TEXT,
    "onlineOrderId" TEXT,
    "externalOrderId" TEXT,
    "integrationProvider" TEXT,
    "baseAmount" DECIMAL(10,2) NOT NULL,
    "ibsRate" DECIMAL(6,4),
    "ibsAmount" DECIMAL(10,2),
    "cbsRate" DECIMAL(6,4),
    "cbsAmount" DECIMAL(10,2),
    "status" "FiscalOperationStatus" NOT NULL DEFAULT 'PENDING',
    "competencePeriod" TEXT,
    "taxDocumentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TaxDocument" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentType" TEXT,
    "externalDocumentId" TEXT,
    "status" "FiscalOperationStatus" NOT NULL DEFAULT 'PENDING',
    "issuedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TaxSplitAllocation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "taxTransactionId" TEXT NOT NULL,
    "provider" TEXT,
    "status" "FiscalOperationStatus" NOT NULL DEFAULT 'PENDING',
    "grossAmount" DECIMAL(10,2) NOT NULL,
    "segregatedAmount" DECIMAL(10,2),
    "netAmount" DECIMAL(10,2),
    "walletTransactionId" TEXT,
    "externalReference" TEXT,
    "gatewayResponse" JSONB,
    "authorizedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "reversedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxSplitAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TaxSettlement" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "taxSplitAllocationId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "FiscalOperationStatus" NOT NULL DEFAULT 'PENDING',
    "settledAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TaxRefund" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "taxTransactionId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT,
    "status" "FiscalOperationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TaxAdjustment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "taxTransactionId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TaxConfiguration_companyId_key" ON "TaxConfiguration"("companyId");

CREATE INDEX IF NOT EXISTS "TaxTransaction_companyId_idx" ON "TaxTransaction"("companyId");
CREATE INDEX IF NOT EXISTS "TaxTransaction_companyId_status_idx" ON "TaxTransaction"("companyId", "status");
CREATE INDEX IF NOT EXISTS "TaxTransaction_companyId_channel_idx" ON "TaxTransaction"("companyId", "channel");
CREATE INDEX IF NOT EXISTS "TaxTransaction_orderId_idx" ON "TaxTransaction"("orderId");
CREATE INDEX IF NOT EXISTS "TaxTransaction_onlineOrderId_idx" ON "TaxTransaction"("onlineOrderId");
CREATE INDEX IF NOT EXISTS "TaxTransaction_externalOrderId_idx" ON "TaxTransaction"("externalOrderId");

CREATE INDEX IF NOT EXISTS "TaxDocument_companyId_idx" ON "TaxDocument"("companyId");
CREATE INDEX IF NOT EXISTS "TaxDocument_companyId_status_idx" ON "TaxDocument"("companyId", "status");

CREATE INDEX IF NOT EXISTS "TaxSplitAllocation_companyId_idx" ON "TaxSplitAllocation"("companyId");
CREATE INDEX IF NOT EXISTS "TaxSplitAllocation_taxTransactionId_idx" ON "TaxSplitAllocation"("taxTransactionId");
CREATE INDEX IF NOT EXISTS "TaxSplitAllocation_status_idx" ON "TaxSplitAllocation"("status");

CREATE INDEX IF NOT EXISTS "TaxSettlement_companyId_idx" ON "TaxSettlement"("companyId");
CREATE INDEX IF NOT EXISTS "TaxSettlement_taxSplitAllocationId_idx" ON "TaxSettlement"("taxSplitAllocationId");

CREATE INDEX IF NOT EXISTS "TaxRefund_companyId_idx" ON "TaxRefund"("companyId");
CREATE INDEX IF NOT EXISTS "TaxRefund_taxTransactionId_idx" ON "TaxRefund"("taxTransactionId");

CREATE INDEX IF NOT EXISTS "TaxAdjustment_companyId_idx" ON "TaxAdjustment"("companyId");
CREATE INDEX IF NOT EXISTS "TaxAdjustment_taxTransactionId_idx" ON "TaxAdjustment"("taxTransactionId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "TaxConfiguration" ADD CONSTRAINT "TaxConfiguration_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TaxTransaction" ADD CONSTRAINT "TaxTransaction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TaxTransaction" ADD CONSTRAINT "TaxTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TaxTransaction" ADD CONSTRAINT "TaxTransaction_onlineOrderId_fkey" FOREIGN KEY ("onlineOrderId") REFERENCES "OnlineOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TaxTransaction" ADD CONSTRAINT "TaxTransaction_taxDocumentId_fkey" FOREIGN KEY ("taxDocumentId") REFERENCES "TaxDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TaxDocument" ADD CONSTRAINT "TaxDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TaxSplitAllocation" ADD CONSTRAINT "TaxSplitAllocation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TaxSplitAllocation" ADD CONSTRAINT "TaxSplitAllocation_taxTransactionId_fkey" FOREIGN KEY ("taxTransactionId") REFERENCES "TaxTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TaxSettlement" ADD CONSTRAINT "TaxSettlement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TaxSettlement" ADD CONSTRAINT "TaxSettlement_taxSplitAllocationId_fkey" FOREIGN KEY ("taxSplitAllocationId") REFERENCES "TaxSplitAllocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TaxRefund" ADD CONSTRAINT "TaxRefund_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TaxRefund" ADD CONSTRAINT "TaxRefund_taxTransactionId_fkey" FOREIGN KEY ("taxTransactionId") REFERENCES "TaxTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TaxAdjustment" ADD CONSTRAINT "TaxAdjustment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TaxAdjustment" ADD CONSTRAINT "TaxAdjustment_taxTransactionId_fkey" FOREIGN KEY ("taxTransactionId") REFERENCES "TaxTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
