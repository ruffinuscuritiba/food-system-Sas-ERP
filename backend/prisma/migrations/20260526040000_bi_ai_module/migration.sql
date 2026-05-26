-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('LOW_STOCK', 'HIGH_CMV', 'REVENUE_DROP', 'TICKET_DROP', 'CANCELLATION_SPIKE');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateTable
CREATE TABLE "KpiSnapshot" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "snapshotAt" TIMESTAMP(3) NOT NULL,
    "revenue" DECIMAL(14,2) NOT NULL,
    "cmv" DECIMAL(14,2) NOT NULL,
    "grossProfit" DECIMAL(14,2) NOT NULL,
    "grossMargin" DECIMAL(7,4) NOT NULL,
    "orderCount" INTEGER NOT NULL,
    "avgTicket" DECIMAL(10,2) NOT NULL,
    "cancelledCount" INTEGER NOT NULL,
    "deliveryCount" INTEGER NOT NULL,
    "dineInCount" INTEGER NOT NULL,
    "pickupCount" INTEGER NOT NULL,
    "pixRevenue" DECIMAL(14,2) NOT NULL,
    "cardRevenue" DECIMAL(14,2) NOT NULL,
    "cashRevenue" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KpiSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiConversation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "ChatRole" NOT NULL,
    "content" TEXT NOT NULL,
    "tokensUsed" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationalCost" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "period" TEXT,
    "referenceAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationalCost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KpiSnapshot_companyId_snapshotAt_key" ON "KpiSnapshot"("companyId", "snapshotAt");
CREATE INDEX "KpiSnapshot_companyId_idx" ON "KpiSnapshot"("companyId");
CREATE INDEX "KpiSnapshot_snapshotAt_idx" ON "KpiSnapshot"("snapshotAt");

CREATE INDEX "Alert_companyId_idx" ON "Alert"("companyId");
CREATE INDEX "Alert_read_idx" ON "Alert"("read");
CREATE INDEX "Alert_createdAt_idx" ON "Alert"("createdAt");

CREATE INDEX "AiConversation_companyId_idx" ON "AiConversation"("companyId");

CREATE INDEX "AiMessage_conversationId_idx" ON "AiMessage"("conversationId");

CREATE INDEX "OperationalCost_companyId_idx" ON "OperationalCost"("companyId");
CREATE INDEX "OperationalCost_referenceAt_idx" ON "OperationalCost"("referenceAt");

-- AddForeignKey
ALTER TABLE "AiMessage" ADD CONSTRAINT "AiMessage_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
