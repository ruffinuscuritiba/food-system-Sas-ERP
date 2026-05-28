-- ── Fix DB sync issues (fully idempotent via pg_constraint checks) ───────────

-- 1. Add EXTRA_GRANDE to PizzaSize enum
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'PizzaSize' AND e.enumlabel = 'EXTRA_GRANDE'
  ) THEN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PizzaSize') THEN
      ALTER TYPE "PizzaSize" ADD VALUE 'EXTRA_GRANDE';
    END IF;
  END IF;
END $$;

-- 2. Add customerId column to LoyaltyAccount
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'LoyaltyAccount' AND column_name = 'customerId'
  ) THEN
    ALTER TABLE "LoyaltyAccount" ADD COLUMN "customerId" TEXT;
  END IF;
END $$;

-- 3. Add unique constraint on LoyaltyAccount.customerId
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LoyaltyAccount_customerId_key'
  ) THEN
    ALTER TABLE "LoyaltyAccount" ADD CONSTRAINT "LoyaltyAccount_customerId_key" UNIQUE ("customerId");
  END IF;
END $$;

-- 4. Add composite unique (customerId, companyId) on LoyaltyAccount
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LoyaltyAccount_customerId_companyId_key'
  ) THEN
    ALTER TABLE "LoyaltyAccount" ADD CONSTRAINT "LoyaltyAccount_customerId_companyId_key" UNIQUE ("customerId", "companyId");
  END IF;
END $$;

-- 5. Add FK from LoyaltyAccount.customerId -> Customer.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LoyaltyAccount_customerId_fkey'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'Customer'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'LoyaltyAccount' AND column_name = 'customerId'
  ) THEN
    ALTER TABLE "LoyaltyAccount"
      ADD CONSTRAINT "LoyaltyAccount_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- 6. Ensure OnlineOrder/PaymentWebhook enums exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OnlineOrderStatus') THEN
    CREATE TYPE "OnlineOrderStatus" AS ENUM ('PENDING','CONFIRMED','PREPARING','READY','DELIVERING','COMPLETED','CANCELED');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OnlinePaymentStatus') THEN
    CREATE TYPE "OnlinePaymentStatus" AS ENUM ('PENDING','APPROVED','REJECTED','REFUNDED','EXPIRED');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OnlinePaymentMethod') THEN
    CREATE TYPE "OnlinePaymentMethod" AS ENUM ('PIX','CREDIT_CARD','DEBIT_CARD','CASH');
  END IF;
END $$;

-- 7. Create OnlineOrder table
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
CREATE INDEX IF NOT EXISTS "OnlineOrder_companyId_idx"     ON "OnlineOrder"("companyId");
CREATE INDEX IF NOT EXISTS "OnlineOrder_paymentStatus_idx" ON "OnlineOrder"("paymentStatus");
CREATE INDEX IF NOT EXISTS "OnlineOrder_orderStatus_idx"   ON "OnlineOrder"("orderStatus");
CREATE INDEX IF NOT EXISTS "OnlineOrder_createdAt_idx"     ON "OnlineOrder"("createdAt");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OnlineOrder_companyId_fkey'
  ) THEN
    ALTER TABLE "OnlineOrder"
      ADD CONSTRAINT "OnlineOrder_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- 8. Create PaymentWebhook table
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
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PaymentWebhook_gateway_eventId_key'
  ) THEN
    ALTER TABLE "PaymentWebhook"
      ADD CONSTRAINT "PaymentWebhook_gateway_eventId_key" UNIQUE ("gateway", "eventId");
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "PaymentWebhook_processed_idx"  ON "PaymentWebhook"("processed");
CREATE INDEX IF NOT EXISTS "PaymentWebhook_companyId_idx"  ON "PaymentWebhook"("companyId");
