-- Idempotente: seguro rodar em qualquer estado do banco.
ALTER TABLE "DriverProfile" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3);
