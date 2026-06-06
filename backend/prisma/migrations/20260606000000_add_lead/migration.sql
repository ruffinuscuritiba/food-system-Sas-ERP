-- Migration: 20260606000000_add_lead
-- Adds Lead table for capturing qualified leads from the public Kely AI demo.
-- Fully idempotent: uses IF NOT EXISTS / DO $$ blocks throughout.

CREATE TABLE IF NOT EXISTS "Lead" (
    "id"                  TEXT        NOT NULL,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionToken"        TEXT        NOT NULL,
    "name"                TEXT,
    "company"             TEXT,
    "whatsapp"            TEXT,
    "recommendedPlan"     TEXT,
    "source"              TEXT        NOT NULL DEFAULT 'IA_DEMO',
    "conversationSummary" TEXT,
    "status"              TEXT        NOT NULL DEFAULT 'NOVO',
    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- Unique index on sessionToken
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'Lead' AND indexname = 'Lead_sessionToken_key'
    ) THEN
        CREATE UNIQUE INDEX "Lead_sessionToken_key" ON "Lead"("sessionToken");
    END IF;
END $$;

-- Index on status
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'Lead' AND indexname = 'Lead_status_idx'
    ) THEN
        CREATE INDEX "Lead_status_idx" ON "Lead"("status");
    END IF;
END $$;

-- Index on createdAt
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'Lead' AND indexname = 'Lead_createdAt_idx'
    ) THEN
        CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");
    END IF;
END $$;
