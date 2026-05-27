-- Migration idempotente: usa IF NOT EXISTS / EXCEPTION handlers
-- porque o enum PizzaSize pode já existir de uma migration anterior parcial.

-- CreateEnum (idempotent)
DO $$ BEGIN
  CREATE TYPE "PizzaSize" AS ENUM ('PEQUENA', 'MEDIA', 'GRANDE', 'FAMILIA', 'EXTRA_GRANDE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable PizzaBorder (idempotent)
CREATE TABLE IF NOT EXISTS "PizzaBorder" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PizzaBorder_pkey" PRIMARY KEY ("id")
);

-- CreateTable PizzaBorderSize (idempotent)
CREATE TABLE IF NOT EXISTS "PizzaBorderSize" (
    "id" TEXT NOT NULL,
    "pizzaBorderId" TEXT NOT NULL,
    "size" "PizzaSize" NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "PizzaBorderSize_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "PizzaBorder_companyId_idx" ON "PizzaBorder"("companyId");
CREATE INDEX IF NOT EXISTS "PizzaBorderSize_pizzaBorderId_idx" ON "PizzaBorderSize"("pizzaBorderId");
CREATE UNIQUE INDEX IF NOT EXISTS "PizzaBorderSize_pizzaBorderId_size_key" ON "PizzaBorderSize"("pizzaBorderId", "size");

-- AddForeignKey PizzaBorder → Company (idempotent)
DO $$ BEGIN
  ALTER TABLE "PizzaBorder" ADD CONSTRAINT "PizzaBorder_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey PizzaBorderSize → PizzaBorder (idempotent)
DO $$ BEGIN
  ALTER TABLE "PizzaBorderSize" ADD CONSTRAINT "PizzaBorderSize_pizzaBorderId_fkey"
    FOREIGN KEY ("pizzaBorderId") REFERENCES "PizzaBorder"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
