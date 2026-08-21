-- Category: cor da aba (frente de caixa da Marmitaria, estilo Consumer/Goomer).
-- Aditivo, idempotente.
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "color" TEXT;
