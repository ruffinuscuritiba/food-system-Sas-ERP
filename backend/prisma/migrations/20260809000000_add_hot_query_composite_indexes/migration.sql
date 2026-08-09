-- Índices compostos que faltavam pros padrões de query REAIS mais quentes do
-- sistema (achado por auditoria do código, não especulação):
--
-- OnlineOrder só tinha índices de coluna única (companyId/paymentStatus/
-- orderStatus/createdAt). Toda atualização do board da cozinha
-- (findAllForKitchen) faz findMany(companyId, orderBy createdAt desc) — e todo
-- relatório/analytics (reports.service, menu-analytics, products.service —
-- upsell) faz findMany(companyId, orderStatus<>CANCELED, createdAt range).
-- Sem composto, cada uma dessas dependia de um único índice de coluna e
-- filtrava/ordenava o resto na memória do Postgres.
--
-- Cash.findFirst(companyId, isOpen:true, orderBy createdAt desc) é chamado em
-- TODO pedido criado (gate de caixa, item 151 do CLAUDE.md) + qualquer tela
-- que abre PDV/Financeiro — a query mais frequente do módulo, rodando só com
-- índice de companyId sozinho.
--
-- Idempotente (CREATE INDEX IF NOT EXISTS).

CREATE INDEX IF NOT EXISTS "OnlineOrder_companyId_createdAt_idx" ON "OnlineOrder" ("companyId", "createdAt");
CREATE INDEX IF NOT EXISTS "OnlineOrder_companyId_orderStatus_createdAt_idx" ON "OnlineOrder" ("companyId", "orderStatus", "createdAt");
CREATE INDEX IF NOT EXISTS "Cash_companyId_isOpen_createdAt_idx" ON "Cash" ("companyId", "isOpen", "createdAt");
