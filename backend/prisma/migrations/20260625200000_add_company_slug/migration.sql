-- Migration idempotente: adiciona slug único por empresa para URLs amigáveis

ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "slug" TEXT;

-- Backfill: gera slug a partir do nome (sem caracteres especiais)
-- Remove tudo exceto letras, dígitos e espaços → troca espaços por hífens → lowercase
-- Duplicatas: adiciona sufixo numérico via ROW_NUMBER
WITH numbered AS (
  SELECT
    id,
    LOWER(
      COALESCE(
        NULLIF(
          TRIM(REGEXP_REPLACE(
            REGEXP_REPLACE(name, '[^a-zA-Z0-9\s]', '', 'g'),
            '\s+', '-', 'g'
          )),
          ''
        ),
        SUBSTRING(id FROM 2 FOR 8)
      )
    ) AS base_slug,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(
        COALESCE(
          NULLIF(
            TRIM(REGEXP_REPLACE(
              REGEXP_REPLACE(name, '[^a-zA-Z0-9\s]', '', 'g'),
              '\s+', '-', 'g'
            )),
            ''
          ),
          SUBSTRING(id FROM 2 FOR 8)
        )
      )
      ORDER BY "createdAt"
    ) AS rn
  FROM "Company"
  WHERE "slug" IS NULL
)
UPDATE "Company" c
SET "slug" = n.base_slug || CASE WHEN n.rn > 1 THEN '-' || n.rn::text ELSE '' END
FROM numbered n
WHERE c.id = n.id AND c."slug" IS NULL;

-- Unique index idempotente
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Company_slug_key'
  ) THEN
    ALTER TABLE "Company" ADD CONSTRAINT "Company_slug_key" UNIQUE ("slug");
  END IF;
END $$;
