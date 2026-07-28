-- Idempotente: marca mensagens da Kely/operador que o WhatsApp confirmou NÃO ter entregado
ALTER TABLE "WhatsappMessage" ADD COLUMN IF NOT EXISTS "deliveryFailed" BOOLEAN NOT NULL DEFAULT false;
