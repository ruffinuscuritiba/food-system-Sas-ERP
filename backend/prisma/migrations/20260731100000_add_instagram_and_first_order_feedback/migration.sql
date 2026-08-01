-- Idempotente: link do Instagram da loja (convite enviado junto com o pedido
-- de avaliação do Google, só no primeiro pedido do cliente) + flag snapshot
-- em DeliveryFeedback indicando se era o primeiro pedido do cliente no
-- momento em que a pergunta de feedback foi enviada.
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "instagramUrl" TEXT;

ALTER TABLE "DeliveryFeedback" ADD COLUMN IF NOT EXISTS "isFirstOrder" BOOLEAN NOT NULL DEFAULT false;
