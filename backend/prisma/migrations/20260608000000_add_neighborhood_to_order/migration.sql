-- Migration idempotente: adiciona neighborhood ao Order para persistir o bairro
-- do pedido (usado no lookup de DeliveryZone e exibição na cozinha).
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "neighborhood" TEXT;
