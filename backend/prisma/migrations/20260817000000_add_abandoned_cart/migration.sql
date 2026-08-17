-- Migration: add_abandoned_cart
-- Idempotente — mesmo padrão de checks (CREATE TABLE IF NOT EXISTS + FK via
-- DO $$ EXCEPTION WHEN duplicate_object) já usado em outras migrations do
-- projeto (ver 20260630000000_add_qr_recovery_campaigns).

CREATE TABLE IF NOT EXISTS "AbandonedCart" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "customerName" TEXT,
  "items" JSONB NOT NULL,
  "total" DECIMAL(10,2) NOT NULL,
  "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notifiedAt" TIMESTAMP(3),
  "recoveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AbandonedCart_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AbandonedCart_companyId_phone_idx" ON "AbandonedCart"("companyId", "phone");
CREATE INDEX IF NOT EXISTS "AbandonedCart_notifiedAt_recoveredAt_lastActivityAt_idx" ON "AbandonedCart"("notifiedAt", "recoveredAt", "lastActivityAt");

DO $$ BEGIN
  ALTER TABLE "AbandonedCart" ADD CONSTRAINT "AbandonedCart_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
