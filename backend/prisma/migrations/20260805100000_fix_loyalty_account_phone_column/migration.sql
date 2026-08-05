-- LoyaltyAccount.phone é coluna legada (drift antigo, mesma família do item
-- 163 — points/totalOrders/totalSpent renomeados mas essa coluna "phone" NOT
-- NULL sem default sobrou na tabela real, fora do schema.prisma atual).
-- Bloqueava TODO insert de LoyaltyAccount em produção (INSERT via Prisma
-- nunca preenche uma coluna que ele não conhece) — nenhum cliente jamais
-- conseguiu ganhar pontos/cashback de verdade até este fix.
-- DROP NOT NULL é idempotente por natureza (Postgres não erra se já for nullable).
ALTER TABLE "LoyaltyAccount" ALTER COLUMN "phone" DROP NOT NULL;

-- PointTransaction.expiresAt existe no schema.prisma (DateTime?) mas nunca
-- existiu na tabela real — quebrava qualquer leitura (GET /loyalty/balance,
-- que faz include:{transactions}) e qualquer criação de ponto EARNED.
ALTER TABLE "PointTransaction" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

-- PointTransaction.type usava o enum "PointTransactionType" (valores antigos
-- EARN/REDEEM) em vez do "PointType" que o schema.prisma sempre esperou
-- (EARNED/REDEEMED/EXPIRED/BONUS/CASHBACK, tipo que já existia órfão no
-- banco — nenhuma coluna nunca foi migrada pra usá-lo). Tabela real estava
-- vazia (0 linhas) no momento do fix, então a troca de tipo é segura sem
-- necessidade de mapear valores antigos.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PointTransaction' AND column_name = 'type' AND udt_name = 'PointTransactionType'
  ) THEN
    ALTER TABLE "PointTransaction" ALTER COLUMN "type" TYPE "PointType" USING type::text::"PointType";
  END IF;
END $$;
