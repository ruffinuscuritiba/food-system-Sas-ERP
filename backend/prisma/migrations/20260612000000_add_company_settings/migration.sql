-- Migration: 20260612000000_add_company_settings
-- Adiciona campos de configuração centralizada ao model Company.
-- Idempotente: usa ADD COLUMN IF NOT EXISTS em todos os ALTER TABLE.

-- Contato adicional
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "whatsapp"     TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "cnpj"         TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "razaoSocial"  TEXT;

-- Endereço da loja
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "zipCode"      TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "street"       TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "streetNumber" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "complement"   TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "neighborhood" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "city"         TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "state"        TEXT;

-- Horários de funcionamento (JSON)
-- Estrutura: {"0":{"open":"11:00","close":"22:00","isOpen":false},...,"6":{...}}
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "businessHours" JSONB;
