-- Migration idempotente: adiciona parentCategoryId à tabela Category

ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "parentCategoryId" TEXT;

-- FK idempotente
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Category_parentCategoryId_fkey'
  ) THEN
    ALTER TABLE "Category"
      ADD CONSTRAINT "Category_parentCategoryId_fkey"
      FOREIGN KEY ("parentCategoryId")
      REFERENCES "Category"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Índice idempotente
CREATE INDEX IF NOT EXISTS "Category_parentCategoryId_idx" ON "Category"("parentCategoryId");
