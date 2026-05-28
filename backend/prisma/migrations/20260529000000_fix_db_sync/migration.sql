-- ── Fix DB sync issues identified from Render logs ──────────────────────────
-- Run: 2026-05-29
-- All statements are idempotent (IF NOT EXISTS / EXCEPTION WHEN)

-- 1. Add EXTRA_GRANDE to PizzaSize enum (if not present)
DO $$ BEGIN
  ALTER TYPE "PizzaSize" ADD VALUE IF NOT EXISTS 'EXTRA_GRANDE';
EXCEPTION WHEN others THEN
  -- Enum may not exist yet; handled by add_pizza_borders migration
  null;
END $$;

-- 2. Add customerId to LoyaltyAccount (if column missing)
DO $$ BEGIN
  ALTER TABLE "LoyaltyAccount" ADD COLUMN "customerId" TEXT;
EXCEPTION WHEN duplicate_column THEN null; END $$;

-- 3. Add unique constraint on LoyaltyAccount.customerId (if not exists)
DO $$ BEGIN
  ALTER TABLE "LoyaltyAccount" ADD CONSTRAINT "LoyaltyAccount_customerId_key" UNIQUE ("customerId");
EXCEPTION WHEN duplicate_table THEN null;
         WHEN duplicate_object THEN null; END $$;

-- 4. Add composite unique constraint (customerId, companyId)
DO $$ BEGIN
  ALTER TABLE "LoyaltyAccount" ADD CONSTRAINT "LoyaltyAccount_customerId_companyId_key" UNIQUE ("customerId", "companyId");
EXCEPTION WHEN duplicate_table THEN null;
         WHEN duplicate_object THEN null; END $$;

-- 5. Add foreign key from LoyaltyAccount.customerId -> Customer.id (if Customer table exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Customer') THEN
    BEGIN
      ALTER TABLE "LoyaltyAccount"
        ADD CONSTRAINT "LoyaltyAccount_customerId_fkey"
        FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN null; END;
  END IF;
END $$;

-- 6. Ensure OnlineOrder table enums exist (idempotent)
DO $$ BEGIN
  CREATE TYPE "OnlineOrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERING', 'COMPLETED', 'CANCELED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "OnlinePaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REFUNDED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "OnlinePaymentMethod" AS ENUM ('PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 7. Ensure OnlineOrder table exists
CREATE TABLE IF NOT EXISTS "OnlineOrder" (
  "id"                      TEXT NOT NULL,
  "companyId"               TEXT NOT NULL,
  "customerName"            TEXT NOT NULL,
  "customerPhone"           TEXT NOT NULL,
  "customerEmail"           TEXT,
  "orderType"               TEXT NOT NULL DEFAULT 'DELIVERY',
  "address"                 TEXT,
  "addressNumber"           TEXT,
  "neighborhood"            TEXT,
  "city"                    TEXT,
  "state"                   TEXT,
  "zipcode"                 TEXT,
  "complement"              TEXT,
  "items"                   JSONB NOT NULL,
  "subtotal"                DECIMAL(10,2) NOT NULL,
  "deliveryFee"             DECIMAL(10,2) NOT NULL DEFAULT 0,
  "discount"                DECIMAL(10,2) NOT NULL DEFAULT 0,
  "total"                   DECIMAL(10,2) NOT NULL,
  "paymentMethod"           TEXT NOT NULL DEFAULT 'PIX',
  "paymentGateway"          TEXT NOT NULL DEFAULT 'MERCADOPAGO',
  "paymentStatus"           TEXT NOT NULL DEFAULT 'PENDING',
  "orderStatus"             TEXT NOT NULL DEFAULT 'PENDING',
  "mercadopagoPaymentId"    TEXT,
  "mercadopagoPreferenceId" TEXT,
  "pixQrcode"               TEXT,
  "pixCopyPaste"            TEXT,
  "pixExpiresAt"            TIMESTAMP(3),
  "notes"                   TEXT,
  "paidAt"                  TIMESTAMP(3),
  "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OnlineOrder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OnlineOrder_companyId_idx" ON "OnlineOrder"("companyId");
CREATE INDEX IF NOT EXISTS "OnlineOrder_paymentStatus_idx" ON "OnlineOrder"("paymentStatus");
CREATE INDEX IF NOT EXISTS "OnlineOrder_orderStatus_idx" ON "OnlineOrder"("orderStatus");
CREATE INDEX IF NOT EXISTS "OnlineOrder_createdAt_idx" ON "OnlineOrder"("createdAt");

DO $$ BEGIN
  ALTER TABLE "OnlineOrder" ADD CONSTRAINT "OnlineOrder_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 8. Ensure PaymentWebhook table exists
CREATE TABLE IF NOT EXISTS "PaymentWebhook" (
  "id"        TEXT NOT NULL,
  "companyId" TEXT,
  "gateway"   TEXT NOT NULL,
  "eventId"   TEXT NOT NULL,
  "event"     TEXT NOT NULL,
  "payload"   JSONB NOT NULL,
  "processed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentWebhook_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "PaymentWebhook" ADD CONSTRAINT "PaymentWebhook_gateway_eventId_key" UNIQUE ("gateway", "eventId");
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "PaymentWebhook_processed_idx" ON "PaymentWebhook"("processed");
CREATE INDEX IF NOT EXISTS "PaymentWebhook_companyId_idx" ON "PaymentWebhook"("companyId");
