-- Add metaPixelId and googleAnalyticsId to Company table
DO $$ BEGIN
  ALTER TABLE "Company" ADD COLUMN "metaPixelId" TEXT;
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Company" ADD COLUMN "googleAnalyticsId" TEXT;
EXCEPTION WHEN duplicate_column THEN null; END $$;
