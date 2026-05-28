-- ─── Feature 1: maxFlavors per pizza size ──────────────────────────────────

CREATE TABLE IF NOT EXISTS "PizzaSizeConfig" (
  "id"         TEXT NOT NULL DEFAULT gen_random_uuid(),
  "companyId"  TEXT NOT NULL,
  "size"       TEXT NOT NULL,
  "label"      TEXT NOT NULL,
  "slices"     INTEGER NOT NULL DEFAULT 8,
  "maxFlavors" INTEGER NOT NULL DEFAULT 1,
  "isActive"   BOOLEAN NOT NULL DEFAULT true,
  "sortOrder"  INTEGER NOT NULL DEFAULT 0,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PizzaSizeConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PizzaSizeConfig_companyId_size_key" ON "PizzaSizeConfig"("companyId", "size");
CREATE INDEX IF NOT EXISTS "PizzaSizeConfig_companyId_idx" ON "PizzaSizeConfig"("companyId");

ALTER TABLE "PizzaSizeConfig"
  ADD CONSTRAINT "PizzaSizeConfig_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Feature 2: Category — allowMultipleFlavors + categoryType + displayColumns ─

ALTER TABLE "Category"
  ADD COLUMN IF NOT EXISTS "allowMultipleFlavors" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "categoryType" TEXT NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS "displayColumns" INTEGER NOT NULL DEFAULT 4;

-- ─── Feature 2: Product — productType + eanCode ─────────────────────────────

ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "productType" TEXT NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS "eanCode" TEXT;

-- ─── Feature 2: OrderItem — complementsData ─────────────────────────────────

ALTER TABLE "OrderItem"
  ADD COLUMN IF NOT EXISTS "complementsData" JSONB;

-- ─── Feature 2: ComplementType enum ─────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "ComplementType" AS ENUM ('INGREDIENTES', 'ESPECIFICACOES', 'CROSS_SELL', 'DESCARTAVEIS');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ─── Feature 2: Complement table ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Complement" (
  "id"             TEXT NOT NULL DEFAULT gen_random_uuid(),
  "companyId"      TEXT NOT NULL,
  "productId"      TEXT,
  "categoryId"     TEXT,
  "name"           TEXT NOT NULL,
  "type"           "ComplementType" NOT NULL DEFAULT 'INGREDIENTES',
  "required"       BOOLEAN NOT NULL DEFAULT false,
  "chargesExtra"   BOOLEAN NOT NULL DEFAULT true,
  "multipleChoice" BOOLEAN NOT NULL DEFAULT false,
  "minOptions"     INTEGER NOT NULL DEFAULT 0,
  "maxOptions"     INTEGER NOT NULL DEFAULT 1,
  "sortOrder"      INTEGER NOT NULL DEFAULT 0,
  "isActive"       BOOLEAN NOT NULL DEFAULT true,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Complement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Complement_companyId_idx" ON "Complement"("companyId");
CREATE INDEX IF NOT EXISTS "Complement_productId_idx" ON "Complement"("productId");
CREATE INDEX IF NOT EXISTS "Complement_categoryId_idx" ON "Complement"("categoryId");

ALTER TABLE "Complement"
  ADD CONSTRAINT "Complement_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Complement_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Complement_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Feature 2: ComplementOption table ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ComplementOption" (
  "id"           TEXT NOT NULL DEFAULT gen_random_uuid(),
  "complementId" TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "price"        DECIMAL(10,2) NOT NULL DEFAULT 0,
  "imageUrl"     TEXT,
  "isActive"     BOOLEAN NOT NULL DEFAULT true,
  "sortOrder"    INTEGER NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ComplementOption_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ComplementOption_complementId_idx" ON "ComplementOption"("complementId");

ALTER TABLE "ComplementOption"
  ADD CONSTRAINT "ComplementOption_complementId_fkey"
    FOREIGN KEY ("complementId") REFERENCES "Complement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Feature 2: OrderItemComplement table ───────────────────────────────────

CREATE TABLE IF NOT EXISTS "OrderItemComplement" (
  "id"                 TEXT NOT NULL DEFAULT gen_random_uuid(),
  "orderItemId"        TEXT NOT NULL,
  "complementOptionId" TEXT NOT NULL,
  "complementName"     TEXT NOT NULL,
  "optionName"         TEXT NOT NULL,
  "price"              DECIMAL(10,2) NOT NULL,
  "quantity"           INTEGER NOT NULL DEFAULT 1,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderItemComplement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OrderItemComplement_orderItemId_idx" ON "OrderItemComplement"("orderItemId");
CREATE INDEX IF NOT EXISTS "OrderItemComplement_complementOptionId_idx" ON "OrderItemComplement"("complementOptionId");

ALTER TABLE "OrderItemComplement"
  ADD CONSTRAINT "OrderItemComplement_orderItemId_fkey"
    FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "OrderItemComplement_complementOptionId_fkey"
    FOREIGN KEY ("complementOptionId") REFERENCES "ComplementOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
