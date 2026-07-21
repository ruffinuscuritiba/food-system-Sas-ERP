-- Gotejamento de envio (maxPerRun) + desativação definitiva (ARCHIVED) para
-- WhatsappCampaign. Idempotente: seguro rodar múltiplas vezes.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'CampaignStatus' AND e.enumlabel = 'ARCHIVED'
  ) THEN
    ALTER TYPE "CampaignStatus" ADD VALUE 'ARCHIVED';
  END IF;
END $$;

ALTER TABLE "WhatsappCampaign" ADD COLUMN IF NOT EXISTS "maxPerRun" INTEGER NOT NULL DEFAULT 50;
