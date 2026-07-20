-- IngredientAlias: nome como aparece numa nota fiscal mapeado para o
-- Ingredient correto (idempotente).

CREATE TABLE IF NOT EXISTS "IngredientAlias" (
  "id"           TEXT NOT NULL,
  "alias"        TEXT NOT NULL,
  "ingredientId" TEXT NOT NULL,
  "companyId"    TEXT NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IngredientAlias_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'IngredientAlias_companyId_alias_key'
  ) THEN
    ALTER TABLE "IngredientAlias" ADD CONSTRAINT "IngredientAlias_companyId_alias_key" UNIQUE ("companyId", "alias");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'IngredientAlias_ingredientId_fkey') THEN
    ALTER TABLE "IngredientAlias" ADD CONSTRAINT "IngredientAlias_ingredientId_fkey"
      FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'IngredientAlias_companyId_fkey') THEN
    ALTER TABLE "IngredientAlias" ADD CONSTRAINT "IngredientAlias_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "IngredientAlias_ingredientId_idx" ON "IngredientAlias"("ingredientId");
