-- ── Fase 2: Add orderType, customerName, customerPhone, deliveryAddress to Order ──
-- Fully idempotent via information_schema checks

-- 1. orderType column (NOT NULL with default DINE_IN)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Order' AND column_name = 'orderType'
  ) THEN
    ALTER TABLE "Order" ADD COLUMN "orderType" TEXT NOT NULL DEFAULT 'DINE_IN';
  END IF;
END $$;

-- 2. customerName column (nullable)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Order' AND column_name = 'customerName'
  ) THEN
    ALTER TABLE "Order" ADD COLUMN "customerName" TEXT;
  END IF;
END $$;

-- 3. customerPhone column (nullable)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Order' AND column_name = 'customerPhone'
  ) THEN
    ALTER TABLE "Order" ADD COLUMN "customerPhone" TEXT;
  END IF;
END $$;

-- 4. deliveryAddress column (nullable)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Order' AND column_name = 'deliveryAddress'
  ) THEN
    ALTER TABLE "Order" ADD COLUMN "deliveryAddress" TEXT;
  END IF;
END $$;

-- 5. Index on orderType for report queries (only if not exists)
CREATE INDEX IF NOT EXISTS "Order_orderType_idx" ON "Order"("orderType");
