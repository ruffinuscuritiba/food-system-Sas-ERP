-- Rastreia campanhas geradas com sucesso pela IA em /marketing, só para
-- aplicar o limite diário (3/dia) por empresa. Idempotente.
CREATE TABLE IF NOT EXISTS "AiCampaignGeneration" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiCampaignGeneration_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "AiCampaignGeneration" ADD CONSTRAINT "AiCampaignGeneration_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "AiCampaignGeneration_companyId_dateKey_idx" ON "AiCampaignGeneration"("companyId", "dateKey");
