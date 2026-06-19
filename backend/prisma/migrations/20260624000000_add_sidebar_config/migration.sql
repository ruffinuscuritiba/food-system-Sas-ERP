-- Migration idempotente: adiciona sidebarConfig à Company
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "sidebarConfig" JSONB;
