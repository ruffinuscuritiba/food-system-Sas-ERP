-- Migration idempotente: DriverPaymentStatus enum + DriverEarning + DriverPayment

-- 1. Enum DriverPaymentStatus
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DriverPaymentStatus') THEN
    CREATE TYPE "DriverPaymentStatus" AS ENUM ('PENDING', 'PAID');
  END IF;
END $$;

-- 2. DriverPayment (criado antes de DriverEarning por ser referenciado)
CREATE TABLE IF NOT EXISTS "DriverPayment" (
  "id"              TEXT NOT NULL,
  "companyId"       TEXT NOT NULL,
  "driverProfileId" TEXT NOT NULL,
  "totalAmount"     DECIMAL(10,2) NOT NULL DEFAULT 0,
  "status"          "DriverPaymentStatus" NOT NULL DEFAULT 'PENDING',
  "paidAt"          TIMESTAMP(3),
  "financialId"     TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DriverPayment_pkey" PRIMARY KEY ("id")
);

-- 3. DriverEarning
CREATE TABLE IF NOT EXISTS "DriverEarning" (
  "id"              TEXT NOT NULL,
  "orderId"         TEXT NOT NULL,
  "companyId"       TEXT NOT NULL,
  "driverProfileId" TEXT NOT NULL,
  "customerFee"     DECIMAL(10,2) NOT NULL,
  "driverAmount"    DECIMAL(10,2) NOT NULL,
  "platformFee"     DECIMAL(10,2) NOT NULL,
  "status"          "DriverPaymentStatus" NOT NULL DEFAULT 'PENDING',
  "driverPaymentId" TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DriverEarning_pkey" PRIMARY KEY ("id")
);

-- 4. UNIQUE orderId (uma earning por pedido entregue)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DriverEarning_orderId_key'
  ) THEN
    ALTER TABLE "DriverEarning" ADD CONSTRAINT "DriverEarning_orderId_key" UNIQUE ("orderId");
  END IF;
END $$;

-- 5. FK DriverEarning
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DriverEarning_orderId_fkey') THEN
    ALTER TABLE "DriverEarning" ADD CONSTRAINT "DriverEarning_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DriverEarning_companyId_fkey') THEN
    ALTER TABLE "DriverEarning" ADD CONSTRAINT "DriverEarning_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DriverEarning_driverProfileId_fkey') THEN
    ALTER TABLE "DriverEarning" ADD CONSTRAINT "DriverEarning_driverProfileId_fkey"
      FOREIGN KEY ("driverProfileId") REFERENCES "DriverProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DriverEarning_driverPaymentId_fkey') THEN
    ALTER TABLE "DriverEarning" ADD CONSTRAINT "DriverEarning_driverPaymentId_fkey"
      FOREIGN KEY ("driverPaymentId") REFERENCES "DriverPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 6. FK DriverPayment
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DriverPayment_companyId_fkey') THEN
    ALTER TABLE "DriverPayment" ADD CONSTRAINT "DriverPayment_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DriverPayment_driverProfileId_fkey') THEN
    ALTER TABLE "DriverPayment" ADD CONSTRAINT "DriverPayment_driverProfileId_fkey"
      FOREIGN KEY ("driverProfileId") REFERENCES "DriverProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- 7. Índices
CREATE INDEX IF NOT EXISTS "DriverEarning_companyId_idx"      ON "DriverEarning"("companyId");
CREATE INDEX IF NOT EXISTS "DriverEarning_driverProfileId_idx" ON "DriverEarning"("driverProfileId");
CREATE INDEX IF NOT EXISTS "DriverEarning_driverPaymentId_idx" ON "DriverEarning"("driverPaymentId");
CREATE INDEX IF NOT EXISTS "DriverPayment_companyId_idx"      ON "DriverPayment"("companyId");
CREATE INDEX IF NOT EXISTS "DriverPayment_driverProfileId_idx" ON "DriverPayment"("driverProfileId");
