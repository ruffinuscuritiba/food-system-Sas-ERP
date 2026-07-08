-- Vincula Order à sessão de caixa aberta no momento da criação (auditoria).
-- Nullable e ON DELETE SET NULL: nunca bloqueia nem apaga pedido existente.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "cashId" TEXT;

DO $$ BEGIN
  ALTER TABLE "Order" ADD CONSTRAINT "Order_cashId_fkey"
    FOREIGN KEY ("cashId") REFERENCES "Cash"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "Order_cashId_idx" ON "Order"("cashId");
