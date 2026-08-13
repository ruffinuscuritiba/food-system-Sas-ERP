-- Marca quando o entregador coletou fisicamente um pedido do cardápio
-- digital (app do entregador). Mesmo campo que Order já tem — sem ele, o
-- app do entregador não conseguia registrar a coleta de pedidos ONLINE.
ALTER TABLE "OnlineOrder" ADD COLUMN IF NOT EXISTS "pickedUpAt" TIMESTAMP(3);
