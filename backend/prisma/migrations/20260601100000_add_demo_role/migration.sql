-- Adiciona valor DEMO ao enum Role (operação aditiva — segura e idempotente)
-- ALTER TYPE ADD VALUE não pode ser encapsulado em transação no PostgreSQL,
-- portanto usamos DO $$ com verificação prévia.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN  pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'Role'
          AND e.enumlabel = 'DEMO'
    ) THEN
        ALTER TYPE "Role" ADD VALUE 'DEMO';
    END IF;
END $$;
