-- Drop tables corrompidas (nunca tiveram dados reais — migracao sempre falhou)
DROP TABLE IF EXISTS "PointTransaction";
DROP TABLE IF EXISTS "LoyaltyAccount";
DROP TYPE IF EXISTS "PointTransactionType";

-- Recria tudo limpo
CREATE TYPE "PointTransactionType" AS ENUM ('EARN', 'REDEEM');

CREATE TABLE "LoyaltyAccount" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "totalSpent" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LoyaltyAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PointTransaction" (
    "id" TEXT NOT NULL,
    "loyaltyAccountId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "PointTransactionType" NOT NULL,
    "points" INTEGER NOT NULL,
    "orderId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PointTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LoyaltyAccount_phone_companyId_key" ON "LoyaltyAccount"("phone", "companyId");
CREATE INDEX "LoyaltyAccount_companyId_idx" ON "LoyaltyAccount"("companyId");
CREATE INDEX "LoyaltyAccount_phone_idx" ON "LoyaltyAccount"("phone");
CREATE INDEX "PointTransaction_loyaltyAccountId_idx" ON "PointTransaction"("loyaltyAccountId");
CREATE INDEX "PointTransaction_companyId_idx" ON "PointTransaction"("companyId");

ALTER TABLE "LoyaltyAccount" ADD CONSTRAINT "LoyaltyAccount_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PointTransaction" ADD CONSTRAINT "PointTransaction_loyaltyAccountId_fkey"
    FOREIGN KEY ("loyaltyAccountId") REFERENCES "LoyaltyAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
