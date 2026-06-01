-- Normaliza o campo Company.plan:
-- 1) Troca o valor padrão legado 'DELIVERY' por 'BASIC'
-- 2) Migra registros existentes com valores fora do enum para 'BASIC'
-- Operações idempotentes — seguras para re-execução.

ALTER TABLE "Company" ALTER COLUMN "plan" SET DEFAULT 'BASIC';

UPDATE "Company"
SET    "plan" = 'BASIC'
WHERE  "plan" NOT IN ('BASIC', 'PRO', 'ENTERPRISE');
