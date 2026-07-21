-- Campanhas recorrentes de WhatsApp (reengajamento com opt-in real) — idempotente.
-- Customer.marketingOptIn: consentimento explícito, default false (opt-out por padrão).
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "marketingOptIn" BOOLEAN NOT NULL DEFAULT false;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CampaignStatus') THEN
    CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CampaignSendStatus') THEN
    CREATE TYPE "CampaignSendStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED_INTERVAL', 'SKIPPED_NO_OPTIN', 'SKIPPED_NO_PHONE');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "WhatsappCampaign" (
  "id"              TEXT NOT NULL,
  "companyId"       TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "message"         TEXT NOT NULL,
  "status"          "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "minIntervalDays" INTEGER NOT NULL DEFAULT 15,
  "createdById"     TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WhatsappCampaign_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WhatsappCampaign_companyId_fkey') THEN
    ALTER TABLE "WhatsappCampaign" ADD CONSTRAINT "WhatsappCampaign_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "WhatsappCampaign_companyId_idx" ON "WhatsappCampaign"("companyId");
CREATE INDEX IF NOT EXISTS "WhatsappCampaign_companyId_status_idx" ON "WhatsappCampaign"("companyId", "status");

CREATE TABLE IF NOT EXISTS "WhatsappCampaignSend" (
  "id"           TEXT NOT NULL,
  "campaignId"   TEXT NOT NULL,
  "companyId"    TEXT NOT NULL,
  "customerId"   TEXT,
  "phone"        TEXT NOT NULL,
  "status"       "CampaignSendStatus" NOT NULL,
  "errorMessage" TEXT,
  "sentAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhatsappCampaignSend_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WhatsappCampaignSend_campaignId_fkey') THEN
    ALTER TABLE "WhatsappCampaignSend" ADD CONSTRAINT "WhatsappCampaignSend_campaignId_fkey"
      FOREIGN KEY ("campaignId") REFERENCES "WhatsappCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "WhatsappCampaignSend_campaignId_idx" ON "WhatsappCampaignSend"("campaignId");
CREATE INDEX IF NOT EXISTS "WhatsappCampaignSend_companyId_phone_sentAt_idx" ON "WhatsappCampaignSend"("companyId", "phone", "sentAt");
