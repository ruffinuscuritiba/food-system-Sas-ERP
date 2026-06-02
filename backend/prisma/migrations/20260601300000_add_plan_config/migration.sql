-- Migration: add_plan_config
-- Cria tabela de configuração de preços dos planos. Idempotente.

CREATE TABLE IF NOT EXISTS "PlanConfig" (
  "plan"      TEXT          PRIMARY KEY,
  "price"     DECIMAL(10,2) NOT NULL DEFAULT 0,
  "label"     TEXT          NOT NULL DEFAULT '',
  "tagline"   TEXT,
  "updatedAt" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed dos valores padrão (não sobrescreve se já existir)
INSERT INTO "PlanConfig" ("plan","price","label","tagline","updatedAt") VALUES
  ('BASIC',      149.00, 'Basic',      'Para começar com o essencial',  NOW()),
  ('PRO',        249.00, 'Pro',        'Para operações em crescimento', NOW()),
  ('ENTERPRISE', 399.00, 'Enterprise', 'Tudo liberado, sem limites',    NOW())
ON CONFLICT ("plan") DO NOTHING;
