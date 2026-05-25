DO $$ BEGIN
  CREATE TYPE "ImportType" AS ENUM ('MENU', 'INVOICE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "ImportStatus" AS ENUM ('PROCESSING', 'DONE', 'ERROR');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "ImportSession" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "ImportType" NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PROCESSING',
    "fileUrl" TEXT,
    "rawResult" JSONB,
    "errorMsg" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ImportItem" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "savedId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ImportLog" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ImportSession_companyId_idx" ON "ImportSession"("companyId");
CREATE INDEX IF NOT EXISTS "ImportSession_status_idx" ON "ImportSession"("status");
CREATE INDEX IF NOT EXISTS "ImportItem_sessionId_idx" ON "ImportItem"("sessionId");
CREATE INDEX IF NOT EXISTS "ImportLog_sessionId_idx" ON "ImportLog"("sessionId");

DO $$ BEGIN
  ALTER TABLE "ImportSession" ADD CONSTRAINT "ImportSession_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ImportItem" ADD CONSTRAINT "ImportItem_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "ImportSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ImportLog" ADD CONSTRAINT "ImportLog_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "ImportSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
