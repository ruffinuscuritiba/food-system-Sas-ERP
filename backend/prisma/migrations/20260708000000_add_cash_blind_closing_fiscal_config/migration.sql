-- ── Fechamento de caixa às cegas + Módulo Fiscal BYOK — migration idempotente ─

-- Cash: campos de fechamento às cegas
ALTER TABLE "Cash" ADD COLUMN IF NOT EXISTS "declaredValue" DECIMAL(10,2);
ALTER TABLE "Cash" ADD COLUMN IF NOT EXISTS "systemValue" DECIMAL(10,2);
ALTER TABLE "Cash" ADD COLUMN IF NOT EXISTS "difference" DECIMAL(10,2);
ALTER TABLE "Cash" ADD COLUMN IF NOT EXISTS "closedByUserId" TEXT;
ALTER TABLE "Cash" ADD COLUMN IF NOT EXISTS "closedByName" TEXT;
ALTER TABLE "Cash" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);

-- Tabela CompanyFiscalConfig (BYOK — credenciais de terceiro, nunca em texto plano)
CREATE TABLE IF NOT EXISTS "CompanyFiscalConfig" (
  "id"                    TEXT NOT NULL DEFAULT gen_random_uuid(),
  "companyId"             TEXT NOT NULL,
  "provider"              TEXT NOT NULL DEFAULT 'FOCUS_NFE',
  "environment"           TEXT NOT NULL DEFAULT 'HOMOLOGACAO',
  "apiKeyEncrypted"       TEXT,
  "apiKeyLast4"           TEXT,
  "certFileBase64"        TEXT,
  "certPasswordEncrypted" TEXT,
  "isActive"              BOOLEAN NOT NULL DEFAULT false,
  "termsAcceptedAt"       TIMESTAMP(3),
  "termsAcceptedByUserId" TEXT,
  "termsAcceptedIp"       TEXT,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyFiscalConfig_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "CompanyFiscalConfig" ADD CONSTRAINT "CompanyFiscalConfig_companyId_key" UNIQUE ("companyId");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CompanyFiscalConfig" ADD CONSTRAINT "CompanyFiscalConfig_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
