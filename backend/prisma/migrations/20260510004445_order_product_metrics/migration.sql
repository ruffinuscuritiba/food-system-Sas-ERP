-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "productId" TEXT,
ADD COLUMN     "productName" TEXT,
ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1;

-- AddForeignKey
ALTER TABLE "RecipeItem" ADD CONSTRAINT "RecipeItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
