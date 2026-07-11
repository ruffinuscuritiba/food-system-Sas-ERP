-- Adiciona 99Food ao catálogo de marketplaces (placeholder — igual Rappi,
-- "Em breve": sem provider implementado no backend ainda).
-- ALTER TYPE ADD VALUE não pode ser encapsulado em transação no PostgreSQL,
-- portanto usamos DO $$ com verificação prévia (mesmo padrão de add_demo_role).

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN  pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'IntegrationProvider'
          AND e.enumlabel = 'NINETY_NINE_FOOD'
    ) THEN
        ALTER TYPE "IntegrationProvider" ADD VALUE 'NINETY_NINE_FOOD';
    END IF;
END $$;
