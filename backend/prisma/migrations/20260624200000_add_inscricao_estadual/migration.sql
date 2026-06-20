-- Adiciona inscrição estadual e nome fantasia à tabela Company (idempotente)
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "inscricaoEstadual" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "nomeFantasia" TEXT;
