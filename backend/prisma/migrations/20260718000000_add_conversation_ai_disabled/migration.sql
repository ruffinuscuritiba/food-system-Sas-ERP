-- Desativação permanente de IA por conversa (contato que nunca deve receber
-- resposta automática — vendedor, fornecedor, número errado etc). Idempotente.
ALTER TABLE "WhatsappConversation" ADD COLUMN IF NOT EXISTS "aiDisabled" BOOLEAN NOT NULL DEFAULT false;
