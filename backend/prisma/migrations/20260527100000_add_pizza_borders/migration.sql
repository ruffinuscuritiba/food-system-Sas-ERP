-- CreateEnum
CREATE TYPE "PizzaSize" AS ENUM ('PEQUENA', 'MEDIA', 'GRANDE', 'FAMILIA', 'EXTRA_GRANDE');

-- CreateTable
CREATE TABLE "PizzaBorder" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PizzaBorder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PizzaBorderSize" (
    "id" TEXT NOT NULL,
    "pizzaBorderId" TEXT NOT NULL,
    "size" "PizzaSize" NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "PizzaBorderSize_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PizzaBorder_companyId_idx" ON "PizzaBorder"("companyId");

-- CreateIndex
CREATE INDEX "PizzaBorderSize_pizzaBorderId_idx" ON "PizzaBorderSize"("pizzaBorderId");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "PizzaBorderSize_pizzaBorderId_size_key" ON "PizzaBorderSize"("pizzaBorderId", "size");

-- AddForeignKey
ALTER TABLE "PizzaBorder" ADD CONSTRAINT "PizzaBorder_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PizzaBorderSize" ADD CONSTRAINT "PizzaBorderSize_pizzaBorderId_fkey"
    FOREIGN KEY ("pizzaBorderId") REFERENCES "PizzaBorder"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
