/*
  Warnings:

  - You are about to alter the column `openingValue` on the `Cash` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - You are about to alter the column `balance` on the `Cash` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - You are about to alter the column `entries` on the `Cash` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - You are about to alter the column `exits` on the `Cash` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - You are about to alter the column `amount` on the `Financial` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - The `paymentMethod` column on the `Financial` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to alter the column `stock` on the `Ingredient` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - You are about to alter the column `cost` on the `Ingredient` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - You are about to alter the column `minimumStock` on the `Ingredient` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - You are about to drop the column `address` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `cmv` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `customerName` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `customerPhone` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `items` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `productId` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `productName` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `productionStatus` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `profit` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `quantity` on the `Order` table. All the data in the column will be lost.
  - You are about to alter the column `total` on the `Order` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - The `status` column on the `Order` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to alter the column `deliveryFee` on the `Order` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - You are about to drop the column `cmv` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `group` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `profit` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `stockQuantity` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `subgroup` on the `Product` table. All the data in the column will be lost.
  - You are about to alter the column `costPrice` on the `Product` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - You are about to alter the column `profitMargin` on the `Product` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(5,2)`.
  - You are about to alter the column `salePrice` on the `Product` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - You are about to alter the column `quantity` on the `RecipeItem` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - You are about to alter the column `quantity` on the `StockMovement` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - You are about to alter the column `previousStock` on the `StockMovement` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - You are about to alter the column `currentStock` on the `StockMovement` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - The `status` column on the `Table` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `items` on the `TableOrder` table. All the data in the column will be lost.
  - You are about to alter the column `total` on the `TableOrder` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - The `status` column on the `TableOrder` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[productId]` on the table `Recipe` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `companyId` to the `Cash` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Cash` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Category` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Company` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Financial` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `type` on the `Financial` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `updatedAt` to the `Ingredient` table without a default value. This is not possible if the table is not empty.
  - Made the column `companyId` on table `Ingredient` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `subtotal` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `paymentMethod` on the `Order` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Made the column `deliveryFee` on table `Order` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `Order` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `companyId` to the `Recipe` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Recipe` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Table` table without a default value. This is not possible if the table is not empty.
  - Added the required column `companyId` to the `TableOrder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `TableOrder` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TableStatus" AS ENUM ('FREE', 'OCCUPIED', 'RESERVED');

-- CreateEnum
CREATE TYPE "CashMovementType" AS ENUM ('ENTRY', 'EXIT', 'SUPPLY', 'WITHDRAW');

-- CreateEnum
CREATE TYPE "FinancialType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'TRANSFER');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SUPER_ADMIN';

-- AlterTable
ALTER TABLE "Cash" ADD COLUMN     "companyId" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "openingValue" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "balance" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "entries" SET DEFAULT 0,
ALTER COLUMN "entries" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "exits" SET DEFAULT 0,
ALTER COLUMN "exits" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "CompanyTheme" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Financial" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "type",
ADD COLUMN     "type" "FinancialType" NOT NULL,
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(10,2),
DROP COLUMN "paymentMethod",
ADD COLUMN     "paymentMethod" "PaymentMethod";

-- AlterTable
ALTER TABLE "Ingredient" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "stock" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "cost" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "companyId" SET NOT NULL,
ALTER COLUMN "minimumStock" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "address",
DROP COLUMN "cmv",
DROP COLUMN "customerName",
DROP COLUMN "customerPhone",
DROP COLUMN "items",
DROP COLUMN "productId",
DROP COLUMN "productName",
DROP COLUMN "productionStatus",
DROP COLUMN "profit",
DROP COLUMN "quantity",
ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "subtotal" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "paymentMethod",
ADD COLUMN     "paymentMethod" "PaymentMethod" NOT NULL,
ALTER COLUMN "total" SET DATA TYPE DECIMAL(10,2),
DROP COLUMN "status",
ADD COLUMN     "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
ALTER COLUMN "deliveryFee" SET NOT NULL,
ALTER COLUMN "deliveryFee" SET DEFAULT 0,
ALTER COLUMN "deliveryFee" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "cmv",
DROP COLUMN "group",
DROP COLUMN "profit",
DROP COLUMN "stockQuantity",
DROP COLUMN "subgroup",
ADD COLUMN     "allowNegativeStock" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "barcode" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sku" TEXT,
ADD COLUMN     "trackStock" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "costPrice" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "profitMargin" SET DATA TYPE DECIMAL(5,2),
ALTER COLUMN "salePrice" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN     "companyId" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "RecipeItem" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "StockMovement" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "previousStock" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "currentStock" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Table" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "TableStatus" NOT NULL DEFAULT 'FREE';

-- AlterTable
ALTER TABLE "TableOrder" DROP COLUMN "items",
ADD COLUMN     "companyId" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "total" SET DATA TYPE DECIMAL(10,2),
DROP COLUMN "status",
ADD COLUMN     "status" "OrderStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableOrderItem" (
    "id" TEXT NOT NULL,
    "tableOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TableOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Customer_companyId_idx" ON "Customer"("companyId");

-- CreateIndex
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "OrderItem_companyId_idx" ON "OrderItem"("companyId");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "TableOrderItem_companyId_idx" ON "TableOrderItem"("companyId");

-- CreateIndex
CREATE INDEX "Cash_companyId_idx" ON "Cash"("companyId");

-- CreateIndex
CREATE INDEX "Category_companyId_idx" ON "Category"("companyId");

-- CreateIndex
CREATE INDEX "Category_name_idx" ON "Category"("name");

-- CreateIndex
CREATE INDEX "Company_name_idx" ON "Company"("name");

-- CreateIndex
CREATE INDEX "CompanyModule_companyId_idx" ON "CompanyModule"("companyId");

-- CreateIndex
CREATE INDEX "Financial_companyId_idx" ON "Financial"("companyId");

-- CreateIndex
CREATE INDEX "Financial_type_idx" ON "Financial"("type");

-- CreateIndex
CREATE INDEX "Ingredient_companyId_idx" ON "Ingredient"("companyId");

-- CreateIndex
CREATE INDEX "Order_companyId_idx" ON "Order"("companyId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "Product_companyId_idx" ON "Product"("companyId");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "Product"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_productId_key" ON "Recipe"("productId");

-- CreateIndex
CREATE INDEX "Recipe_companyId_idx" ON "Recipe"("companyId");

-- CreateIndex
CREATE INDEX "RecipeItem_recipeId_idx" ON "RecipeItem"("recipeId");

-- CreateIndex
CREATE INDEX "RecipeItem_ingredientId_idx" ON "RecipeItem"("ingredientId");

-- CreateIndex
CREATE INDEX "Table_companyId_idx" ON "Table"("companyId");

-- CreateIndex
CREATE INDEX "TableOrder_companyId_idx" ON "TableOrder"("companyId");

-- CreateIndex
CREATE INDEX "User_companyId_idx" ON "User"("companyId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Table" ADD CONSTRAINT "Table_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableOrder" ADD CONSTRAINT "TableOrder_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableOrder" ADD CONSTRAINT "TableOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableOrderItem" ADD CONSTRAINT "TableOrderItem_tableOrderId_fkey" FOREIGN KEY ("tableOrderId") REFERENCES "TableOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableOrderItem" ADD CONSTRAINT "TableOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableOrderItem" ADD CONSTRAINT "TableOrderItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Financial" ADD CONSTRAINT "Financial_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyTheme" ADD CONSTRAINT "CompanyTheme_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cash" ADD CONSTRAINT "Cash_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
