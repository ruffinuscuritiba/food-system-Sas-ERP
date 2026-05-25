DO $$ BEGIN
  ALTER TABLE "CompanyTheme" ADD COLUMN "metaPixelId" TEXT;
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "CompanyTheme" ADD COLUMN "gaId" TEXT;
EXCEPTION WHEN duplicate_column THEN null; END $$;
