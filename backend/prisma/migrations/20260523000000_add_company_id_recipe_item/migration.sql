-- Add companyId to RecipeItem for full tenant isolation
ALTER TABLE "RecipeItem" ADD COLUMN "companyId" TEXT NOT NULL DEFAULT '';

-- Backfill companyId from the related Recipe
UPDATE "RecipeItem" ri
SET "companyId" = r."companyId"
FROM "Recipe" r
WHERE ri."recipeId" = r.id;

-- Remove the temporary default now that data is backfilled
ALTER TABLE "RecipeItem" ALTER COLUMN "companyId" DROP DEFAULT;

-- Add foreign key to Company
ALTER TABLE "RecipeItem"
  ADD CONSTRAINT "RecipeItem_companyId_fkey"
  FOREIGN KEY ("companyId")
  REFERENCES "Company"("id")
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

-- Add index for tenant-scoped queries
CREATE INDEX "RecipeItem_companyId_idx" ON "RecipeItem"("companyId");
