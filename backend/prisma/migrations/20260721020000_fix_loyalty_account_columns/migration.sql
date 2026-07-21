-- Fix de drift real: o Prisma schema declara LoyaltyAccount.totalPoints /
-- totalCashback há tempos, mas nenhuma migration jamais renomeou as
-- colunas antigas (points/totalOrders/totalSpent, criadas na migration
-- original 20260524000001_add_loyalty_system) — todo acesso a essa tabela
-- (GET /loyalty/balance no checkout do cardápio, processOrderReward,
-- validateCoupon/redeemPoints) vinha derrubando com
-- "column LoyaltyAccount.totalPoints does not exist in the current database".
-- Renomeia preservando saldo de pontos já existente em produção.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'LoyaltyAccount' AND column_name = 'points'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'LoyaltyAccount' AND column_name = 'totalPoints'
  ) THEN
    ALTER TABLE "LoyaltyAccount" RENAME COLUMN "points" TO "totalPoints";
  END IF;
END $$;

-- Safety net: garante a coluna em qualquer ambiente (ex: banco que nunca
-- teve "points" pra começar, ou já rodou este fix antes).
ALTER TABLE "LoyaltyAccount" ADD COLUMN IF NOT EXISTS "totalPoints" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LoyaltyAccount" ADD COLUMN IF NOT EXISTS "totalCashback" DECIMAL(10,2) NOT NULL DEFAULT 0;
