-- Migration: 20260612100000_add_delivery_settings
-- Adiciona configurações globais de entrega em Company e campos extras em DeliveryZone.
-- Idempotente: usa ADD COLUMN IF NOT EXISTS em todos os ALTER TABLE.

-- ── Company: configurações globais de entrega ─────────────────────────────────
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "deliveryMethod"    TEXT    NOT NULL DEFAULT 'NEIGHBORHOOD';
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "freeDeliveryAbove" DECIMAL(10,2);
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "ownDelivery"       BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "maxDeliveryRadius" INTEGER;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "storeLat"          DOUBLE PRECISION;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "storeLng"          DOUBLE PRECISION;

-- ── DeliveryZone: campos para raio e cor visual ───────────────────────────────
ALTER TABLE "DeliveryZone" ADD COLUMN IF NOT EXISTS "radiusKm" DECIMAL(5,2);
ALTER TABLE "DeliveryZone" ADD COLUMN IF NOT EXISTS "lat"      DOUBLE PRECISION;
ALTER TABLE "DeliveryZone" ADD COLUMN IF NOT EXISTS "lng"      DOUBLE PRECISION;
ALTER TABLE "DeliveryZone" ADD COLUMN IF NOT EXISTS "color"    TEXT NOT NULL DEFAULT '#f97316';
