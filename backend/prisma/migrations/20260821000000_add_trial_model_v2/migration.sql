-- Reforma do modelo de trial: tipo de negócio no cadastro (Delivery | Completo)
-- + marcador genérico de migração one-off (usado pela TrialModelMigrationService
-- para recalcular dueDate/CompanyModule das empresas já em trial hoje).
-- Idempotente: pode rodar de novo sem quebrar se algum passo já tiver sido aplicado.

ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "businessType" TEXT NOT NULL DEFAULT 'COMPLETO';

CREATE TABLE IF NOT EXISTS "SystemMigrationFlag" (
    "id"      TEXT NOT NULL,
    "key"     TEXT NOT NULL,
    "ranAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" TEXT,
    CONSTRAINT "SystemMigrationFlag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SystemMigrationFlag_key_key" ON "SystemMigrationFlag"("key");
