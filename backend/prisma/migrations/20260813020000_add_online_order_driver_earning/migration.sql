-- Repasse do entregador pra pedido do cardápio digital (OnlineOrder nunca
-- teve isso — DriverEarning.orderId era obrigatório e apontava só pra
-- Order/PDV, então nenhum pedido ONLINE entregue gerava ganho registrado
-- pro entregador). Idempotente.

ALTER TABLE "OnlineOrder" ADD COLUMN IF NOT EXISTS "driverFee" DECIMAL(10,2);

-- orderId deixa de ser obrigatório — um DriverEarning agora referencia OU
-- Order OU OnlineOrder (nunca os dois), nunca ambos vazios.
ALTER TABLE "DriverEarning" ALTER COLUMN "orderId" DROP NOT NULL;

ALTER TABLE "DriverEarning" ADD COLUMN IF NOT EXISTS "onlineOrderId" TEXT;

DO $$ BEGIN
  ALTER TABLE "DriverEarning" ADD CONSTRAINT "DriverEarning_onlineOrderId_fkey"
    FOREIGN KEY ("onlineOrderId") REFERENCES "OnlineOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "DriverEarning_onlineOrderId_key" ON "DriverEarning"("onlineOrderId");
