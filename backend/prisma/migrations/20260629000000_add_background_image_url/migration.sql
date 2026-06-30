-- AddColumn backgroundImageUrl to CompanyTheme (idempotente)
ALTER TABLE "CompanyTheme" ADD COLUMN IF NOT EXISTS "backgroundImageUrl" TEXT;
