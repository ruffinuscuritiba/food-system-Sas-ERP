-- Convert PizzaSize enum columns to TEXT so size labels become fully customizable.
-- Existing data ("PEQUENA", "MEDIA", etc.) is preserved as-is via ::TEXT cast.

-- 1. ProductSize.size
ALTER TABLE "ProductSize"
  ALTER COLUMN "size" TYPE TEXT USING "size"::TEXT;

-- 2. PizzaBorderSize.size (if table exists)
DO $$ BEGIN
  ALTER TABLE "PizzaBorderSize"
    ALTER COLUMN "size" TYPE TEXT USING "size"::TEXT;
EXCEPTION WHEN undefined_table THEN null; END $$;

-- 3. OrderItem.pizzaSize (nullable)
DO $$ BEGIN
  ALTER TABLE "OrderItem"
    ALTER COLUMN "pizzaSize" TYPE TEXT USING "pizzaSize"::TEXT;
EXCEPTION WHEN undefined_column THEN null; END $$;
