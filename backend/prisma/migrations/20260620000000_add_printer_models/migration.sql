-- Migration: add_printer_models
-- Idempotent: all operations use IF NOT EXISTS / DO $$ guards

-- ── Enums ──────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "PrinterConnectionType" AS ENUM ('BROWSER', 'NETWORK', 'USB');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PrinterPaperWidth" AS ENUM ('MM_58', 'MM_80');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PrinterRole" AS ENUM ('KITCHEN', 'BAR', 'COUNTER', 'DELIVERY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PrintJobStatus" AS ENUM ('PENDING', 'SENT', 'PRINTED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Printer ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Printer" (
  "id"             TEXT NOT NULL,
  "companyId"      TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "brand"          TEXT,
  "connectionType" "PrinterConnectionType" NOT NULL DEFAULT 'BROWSER',
  "address"        TEXT,
  "paperWidth"     "PrinterPaperWidth" NOT NULL DEFAULT 'MM_80',
  "isOnline"       BOOLEAN NOT NULL DEFAULT false,
  "isActive"       BOOLEAN NOT NULL DEFAULT true,
  "lastSeenAt"     TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Printer_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "Printer" ADD CONSTRAINT "Printer_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Printer_companyId_idx" ON "Printer"("companyId");

-- ── PrinterProfile ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "PrinterProfile" (
  "id"        TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "printerId" TEXT NOT NULL,
  "role"      "PrinterRole" NOT NULL,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrinterProfile_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "PrinterProfile" ADD CONSTRAINT "PrinterProfile_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PrinterProfile" ADD CONSTRAINT "PrinterProfile_printerId_fkey"
    FOREIGN KEY ("printerId") REFERENCES "Printer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PrinterProfile" ADD CONSTRAINT "PrinterProfile_printerId_role_key"
    UNIQUE ("printerId", "role");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "PrinterProfile_companyId_idx" ON "PrinterProfile"("companyId");

-- ── PrinterJob ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "PrinterJob" (
  "id"         TEXT NOT NULL,
  "companyId"  TEXT NOT NULL,
  "printerId"  TEXT NOT NULL,
  "orderId"    TEXT,
  "template"   TEXT NOT NULL,
  "payload"    JSONB NOT NULL,
  "status"     "PrintJobStatus" NOT NULL DEFAULT 'PENDING',
  "attempts"   INTEGER NOT NULL DEFAULT 0,
  "printedAt"  TIMESTAMP(3),
  "failReason" TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrinterJob_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "PrinterJob" ADD CONSTRAINT "PrinterJob_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PrinterJob" ADD CONSTRAINT "PrinterJob_printerId_fkey"
    FOREIGN KEY ("printerId") REFERENCES "Printer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "PrinterJob_companyId_status_idx" ON "PrinterJob"("companyId", "status");
CREATE INDEX IF NOT EXISTS "PrinterJob_printerId_status_idx" ON "PrinterJob"("printerId", "status");
CREATE INDEX IF NOT EXISTS "PrinterJob_orderId_idx"          ON "PrinterJob"("orderId");
