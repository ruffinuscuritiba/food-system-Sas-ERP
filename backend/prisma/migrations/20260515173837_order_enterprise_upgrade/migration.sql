/*
  Warnings:

  - Added the required column `productName` to the `OrderItem` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('DELIVERY', 'DINE_IN', 'PICKUP');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StockMovementType" ADD VALUE 'SALE';
ALTER TYPE "StockMovementType" ADD VALUE 'PURCHASE';
ALTER TYPE "StockMovementType" ADD VALUE 'PRODUCTION';
ALTER TYPE "StockMovementType" ADD VALUE 'TRANSFER';
ALTER TYPE "StockMovementType" ADD VALUE 'RETURN';
ALTER TYPE "StockMovementType" ADD VALUE 'CANCELLATION';

-- AlterTable
ALTER TABLE "Ingredient" ADD COLUMN     "allowNegativeStock" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "averageCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "barcode" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastPurchaseCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "sku" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "finishedAt" TIMESTAMP(3),
ADD COLUMN     "outForDeliveryAt" TIMESTAMP(3),
ADD COLUMN     "preparingAt" TIMESTAMP(3),
ADD COLUMN     "readyAt" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "cmv" DECIMAL(10,2),
ADD COLUMN     "productCost" DECIMAL(10,2),
ADD COLUMN     "productName" TEXT NOT NULL,
ADD COLUMN     "productSku" TEXT,
ADD COLUMN     "profit" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "performedById" TEXT,
ADD COLUMN     "referenceId" TEXT,
ADD COLUMN     "referenceType" TEXT,
ADD COLUMN     "totalCost" DECIMAL(10,2),
ADD COLUMN     "unitCost" DECIMAL(10,2);

-- CreateIndex
CREATE INDEX "Ingredient_deletedAt_idx" ON "Ingredient"("deletedAt");

-- CreateIndex
CREATE INDEX "Ingredient_name_idx" ON "Ingredient"("name");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE INDEX "StockMovement_type_idx" ON "StockMovement"("type");

-- CreateIndex
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");
