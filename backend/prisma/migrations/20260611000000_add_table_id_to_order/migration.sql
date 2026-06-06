-- Migration idempotente: Order.tableId → Table FK

-- 1. Coluna tableId em Order
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "tableId" TEXT;

-- 2. FK Order(tableId) → Table(id)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Order_tableId_fkey') THEN
    ALTER TABLE "Order" ADD CONSTRAINT "Order_tableId_fkey"
      FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 3. Índice
CREATE INDEX IF NOT EXISTS "Order_tableId_idx" ON "Order"("tableId");
