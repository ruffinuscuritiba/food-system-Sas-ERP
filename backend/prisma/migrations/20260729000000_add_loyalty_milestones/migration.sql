-- Cliente Fiel: recompensa a cada N pedidos (idempotente).

CREATE TABLE IF NOT EXISTS "LoyaltyMilestoneConfig" (
  "id"              TEXT NOT NULL,
  "companyId"       TEXT NOT NULL,
  "ordersThreshold" INTEGER NOT NULL DEFAULT 10,
  "rewardLabel"     TEXT NOT NULL DEFAULT '1 Pizza Clássica Grátis',
  "isActive"        BOOLEAN NOT NULL DEFAULT false,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LoyaltyMilestoneConfig_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LoyaltyMilestoneConfig_companyId_key'
  ) THEN
    ALTER TABLE "LoyaltyMilestoneConfig" ADD CONSTRAINT "LoyaltyMilestoneConfig_companyId_key" UNIQUE ("companyId");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LoyaltyMilestoneConfig_companyId_fkey') THEN
    ALTER TABLE "LoyaltyMilestoneConfig" ADD CONSTRAINT "LoyaltyMilestoneConfig_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "LoyaltyMilestoneReward" (
  "id"               TEXT NOT NULL,
  "companyId"        TEXT NOT NULL,
  "customerPhone"    TEXT NOT NULL,
  "customerName"     TEXT,
  "milestoneCount"   INTEGER NOT NULL,
  "rewardLabel"      TEXT NOT NULL,
  "redeemed"         BOOLEAN NOT NULL DEFAULT false,
  "redeemedAt"       TIMESTAMP(3),
  "redeemedByUserId" TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoyaltyMilestoneReward_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LoyaltyMilestoneReward_companyId_customerPhone_milestoneCo_key'
  ) THEN
    ALTER TABLE "LoyaltyMilestoneReward" ADD CONSTRAINT "LoyaltyMilestoneReward_companyId_customerPhone_milestoneCo_key"
      UNIQUE ("companyId", "customerPhone", "milestoneCount");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LoyaltyMilestoneReward_companyId_fkey') THEN
    ALTER TABLE "LoyaltyMilestoneReward" ADD CONSTRAINT "LoyaltyMilestoneReward_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "LoyaltyMilestoneReward_companyId_redeemed_idx" ON "LoyaltyMilestoneReward"("companyId", "redeemed");
