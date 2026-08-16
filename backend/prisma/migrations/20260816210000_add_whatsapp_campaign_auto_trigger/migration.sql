-- Migration: add_whatsapp_campaign_auto_trigger
-- Idempotente — mesmo padrão de checks (pg_type/IF NOT EXISTS) já usado em
-- 20260721000000_add_whatsapp_recurring_campaigns.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CampaignTriggerType') THEN
    CREATE TYPE "CampaignTriggerType" AS ENUM ('MANUAL', 'INACTIVE_CUSTOMERS');
  END IF;
END $$;

ALTER TABLE "WhatsappCampaign"
  ADD COLUMN IF NOT EXISTS "triggerType" "CampaignTriggerType" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS "inactiveDaysThreshold" INTEGER;
