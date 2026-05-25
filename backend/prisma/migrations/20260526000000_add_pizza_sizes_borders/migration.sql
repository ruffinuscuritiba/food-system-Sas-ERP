-- ============================================================
-- Pizza Sizes, Borders, and Multi-Flavor support
-- Idempotent migration
-- ============================================================

-- 1. PizzaSize enum
DO $$ BEGIN
  CREATE TYPE "PizzaSize" AS ENUM ('PEQUENA', 'MEDIA', 'GRANDE', 'FAMILIA');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Category.allowMultipleFlavors
DO $$ BEGIN
  ALTER TABLE "Category" ADD COLUMN "allowMultipleFlavors" BOOLEAN NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN null; END $$;

-- 3. ProductSize table
CREATE TABLE IF NOT EXISTS "ProductSize" (
  "id"        TEXT         NOT NULL,
  "productId" TEXT         NOT NULL,
  "size"      "PizzaSize"  NOT NULL,
  "price"     DECIMAL(10,2) NOT NULL,
  "companyId" TEXT         NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductSize_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProductSize_productId_size_key"
  ON "ProductSize"("productId", "size");
CREATE INDEX IF NOT EXISTS "ProductSize_productId_idx"  ON "ProductSize"("productId");
CREATE INDEX IF NOT EXISTS "ProductSize_companyId_idx"  ON "ProductSize"("companyId");

-- 4. PizzaBorder table
CREATE TABLE IF NOT EXISTS "PizzaBorder" (
  "id"        TEXT         NOT NULL,
  "name"      TEXT         NOT NULL,
  "isActive"  BOOLEAN      NOT NULL DEFAULT true,
  "companyId" TEXT         NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PizzaBorder_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PizzaBorder_companyId_idx" ON "PizzaBorder"("companyId");

-- 5. PizzaBorderSize table
CREATE TABLE IF NOT EXISTS "PizzaBorderSize" (
  "id"            TEXT         NOT NULL,
  "pizzaBorderId" TEXT         NOT NULL,
  "size"          "PizzaSize"  NOT NULL,
  "price"         DECIMAL(10,2) NOT NULL,
  CONSTRAINT "PizzaBorderSize_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PizzaBorderSize_pizzaBorderId_size_key"
  ON "PizzaBorderSize"("pizzaBorderId", "size");
CREATE INDEX IF NOT EXISTS "PizzaBorderSize_pizzaBorderId_idx"
  ON "PizzaBorderSize"("pizzaBorderId");

-- 6. OrderItem pizza columns
DO $$ BEGIN
  ALTER TABLE "OrderItem" ADD COLUMN "pizzaSize"     "PizzaSize";
EXCEPTION WHEN duplicate_column THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "OrderItem" ADD COLUMN "pizzaBorderId" TEXT;
EXCEPTION WHEN duplicate_column THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "OrderItem" ADD COLUMN "borderPrice"   DECIMAL(10,2);
EXCEPTION WHEN duplicate_column THEN null; END $$;

-- 7. OrderItemFlavor table
CREATE TABLE IF NOT EXISTS "OrderItemFlavor" (
  "id"          TEXT         NOT NULL,
  "orderItemId" TEXT         NOT NULL,
  "productId"   TEXT         NOT NULL,
  "position"    INTEGER      NOT NULL,
  "companyId"   TEXT         NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderItemFlavor_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OrderItemFlavor_orderItemId_idx" ON "OrderItemFlavor"("orderItemId");
CREATE INDEX IF NOT EXISTS "OrderItemFlavor_productId_idx"   ON "OrderItemFlavor"("productId");

-- 8. Foreign keys (idempotent)
DO $$ BEGIN
  ALTER TABLE "ProductSize" ADD CONSTRAINT "ProductSize_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "PizzaBorder" ADD CONSTRAINT "PizzaBorder_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "PizzaBorderSize" ADD CONSTRAINT "PizzaBorderSize_pizzaBorderId_fkey"
    FOREIGN KEY ("pizzaBorderId") REFERENCES "PizzaBorder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_pizzaBorderId_fkey"
    FOREIGN KEY ("pizzaBorderId") REFERENCES "PizzaBorder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "OrderItemFlavor" ADD CONSTRAINT "OrderItemFlavor_orderItemId_fkey"
    FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "OrderItemFlavor" ADD CONSTRAINT "OrderItemFlavor_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
