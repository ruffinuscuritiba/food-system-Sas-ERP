-- Entregador em pedidos do cardápio digital/totem (OnlineOrder nunca teve
-- isso — atribuir entregador num pedido ONLINE dava 404 "Pedido não
-- encontrado" porque POST /drivers/assign só olhava a tabela Order/PDV).
-- Nullable e ON DELETE SET NULL: nunca bloqueia nem apaga pedido existente.
ALTER TABLE "OnlineOrder" ADD COLUMN IF NOT EXISTS "driverId" TEXT;
ALTER TABLE "OnlineOrder" ADD COLUMN IF NOT EXISTS "assignedAt" TIMESTAMP(3);

DO $$ BEGIN
  ALTER TABLE "OnlineOrder" ADD CONSTRAINT "OnlineOrder_driverId_fkey"
    FOREIGN KEY ("driverId") REFERENCES "DriverProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "OnlineOrder_driverId_idx" ON "OnlineOrder"("driverId");
