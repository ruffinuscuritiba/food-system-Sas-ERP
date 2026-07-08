-- Distingue pedidos vindos de Totem (tablet fixo na mesa) dos pedidos online
-- comuns, apenas para decidir impressão (nao imprime pre-conta pro cliente
-- em pedido de totem). Nao afeta o roteamento de status (source='ONLINE').
ALTER TABLE "OnlineOrder" ADD COLUMN IF NOT EXISTS "channel" TEXT NOT NULL DEFAULT 'ONLINE';
