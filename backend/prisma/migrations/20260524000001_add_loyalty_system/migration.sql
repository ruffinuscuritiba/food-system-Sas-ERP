DO $$ BEGIN
  CREATE TYPE "PointTransactionType" AS ENUM ('EARN', 'REDEEM');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "LoyaltyAccount" (
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

-- Recovery: table may exist from a partial run with missing columns
ALTER TABLE "LoyaltyAccount" ADD COLUMN IF NOT EXISTS "phone" TEXT NOT NULL DEFAULT '';
ALTER TABLE "LoyaltyAccount" ADD COLUMN IF NOT EXISTS "companyId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "LoyaltyAccount" ADD COLUMN IF NOT EXISTS "points" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LoyaltyAccount" ADD COLUMN IF NOT EXISTS "totalOrders" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LoyaltyAccount" ADD COLUMN IF NOT EXISTS "totalSpent" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "LoyaltyAccount" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "LoyaltyAccount" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS "PointTransaction" (
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

CREATE UNIQUE INDEX IF NOT EXISTS "LoyaltyAccount_phone_companyId_key" ON "LoyaltyAccount"("phone", "companyId");
CREATE INDEX IF NOT EXISTS "LoyaltyAccount_companyId_idx" ON "LoyaltyAccount"("companyId");
CREATE INDEX IF NOT EXISTS "LoyaltyAccount_phone_idx" ON "LoyaltyAccount"("phone");
CREATE INDEX IF NOT EXISTS "PointTransaction_loyaltyAccountId_idx" ON "PointTransaction"("loyaltyAccountId");
CREATE INDEX IF NOT EXISTS "PointTransaction_companyId_idx" ON "PointTransaction"("companyId");

DO $$ BEGIN
  ALTER TABLE "LoyaltyAccount" ADD CONSTRAINT "LoyaltyAccount_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "PointTransaction" ADD CONSTRAINT "PointTransaction_loyaltyAccountId_fkey"
    FOREIGN KEY ("loyaltyAccountId") REFERENCES "LoyaltyAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
