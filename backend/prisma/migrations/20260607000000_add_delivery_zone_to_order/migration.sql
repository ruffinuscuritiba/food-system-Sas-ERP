-- Migration: add deliveryZoneId to Order (idempotent)

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryZoneId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Order_deliveryZoneId_fkey'
      AND table_name = 'Order'
  ) THEN
    ALTER TABLE "Order"
      ADD CONSTRAINT "Order_deliveryZoneId_fkey"
      FOREIGN KEY ("deliveryZoneId")
      REFERENCES "DeliveryZone"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS "Order_deliveryZoneId_idx" ON "Order"("deliveryZoneId");
