-- Company.printerAgentToken: credencial dedicada do Printer Agent (.exe),
-- sem expiracao — antes o agente usava o JWT de sessao do admin (expira em
-- 7 dias), quebrando a impressao automatica silenciosamente depois de uma
-- semana. Idempotente.
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "printerAgentToken" TEXT;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Company_printerAgentToken_key'
  ) THEN
    ALTER TABLE "Company" ADD CONSTRAINT "Company_printerAgentToken_key" UNIQUE ("printerAgentToken");
  END IF;
END $$;
