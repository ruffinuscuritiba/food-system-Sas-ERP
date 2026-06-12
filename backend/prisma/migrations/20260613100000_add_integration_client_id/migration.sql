-- Migration idempotente: adiciona clientId a IntegrationConfig
ALTER TABLE "IntegrationConfig" ADD COLUMN IF NOT EXISTS "clientId" TEXT;
