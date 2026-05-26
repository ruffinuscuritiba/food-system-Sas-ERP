-- Delivery Module: DriverProfile, DeliveryZone, Order driver fields

-- 1. DriverProfile
CREATE TABLE IF NOT EXISTS "DriverProfile" (
  "id"           TEXT         NOT NULL,
  "userId"       TEXT         NOT NULL,
  "phone"        TEXT,
  "vehicleType"  TEXT,
  "vehiclePlate" TEXT,
  "isAvailable"  BOOLEAN      NOT NULL DEFAULT true,
  "currentLat"   DOUBLE PRECISION,
  "currentLng"   DOUBLE PRECISION,
  "companyId"    TEXT         NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DriverProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DriverProfile_userId_key" ON "DriverProfile"("userId");
CREATE INDEX IF NOT EXISTS "DriverProfile_companyId_idx" ON "DriverProfile"("companyId");

-- 2. DeliveryZone
CREATE TABLE IF NOT EXISTS "DeliveryZone" (
  "id"           TEXT         NOT NULL,
  "companyId"    TEXT         NOT NULL,
  "name"         TEXT         NOT NULL,
  "type"         TEXT         NOT NULL DEFAULT 'NEIGHBORHOOD',
  "neighborhood" TEXT,
  "baseFee"      DECIMAL(10,2),
  "pricePerKm"   DECIMAL(10,2),
  "clientFee"    DECIMAL(10,2) NOT NULL,
  "driverShare"  DECIMAL(10,2) NOT NULL,
  "isActive"     BOOLEAN      NOT NULL DEFAULT true,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeliveryZone_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DeliveryZone_companyId_idx" ON "DeliveryZone"("companyId");

-- 3. Order: add driver fields
DO $$ BEGIN
  ALTER TABLE "Order" ADD COLUMN "driverId"   TEXT;
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Order" ADD COLUMN "driverFee"  DECIMAL(10,2);
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Order" ADD COLUMN "assignedAt" TIMESTAMP(3);
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Order" ADD COLUMN "pickedUpAt" TIMESTAMP(3);
EXCEPTION WHEN duplicate_column THEN null; END $$;

CREATE INDEX IF NOT EXISTS "Order_driverId_idx" ON "Order"("driverId");

-- 4. Foreign keys
DO $$ BEGIN
  ALTER TABLE "DriverProfile" ADD CONSTRAINT "DriverProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "DriverProfile" ADD CONSTRAINT "DriverProfile_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "DeliveryZone" ADD CONSTRAINT "DeliveryZone_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Order" ADD CONSTRAINT "Order_driverId_fkey"
    FOREIGN KEY ("driverId") REFERENCES "DriverProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
