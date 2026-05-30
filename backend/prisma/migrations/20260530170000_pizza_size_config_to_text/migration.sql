-- Fix: PizzaSizeConfig.size enum→text para resolver erro Postgres 42883
-- "operator does not exist: text = PizzaSize" no upsert.
-- Migration idempotente: só altera se a coluna ainda for enum.

DO $$
DECLARE
  current_type TEXT;
BEGIN
  SELECT data_type INTO current_type
  FROM information_schema.columns
  WHERE table_name = 'PizzaSizeConfig' AND column_name = 'size';

  -- Se a coluna ainda for USER-DEFINED (enum), converte para TEXT
  IF current_type = 'USER-DEFINED' THEN
    ALTER TABLE "PizzaSizeConfig" ALTER COLUMN "size" TYPE TEXT USING "size"::TEXT;
  END IF;
END $$;
