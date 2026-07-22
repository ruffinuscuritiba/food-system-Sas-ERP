-- Idempotente: cria a tabela de feedback pós-entrega (segura o link de
-- avaliação do Google até o cliente responder ou expirar o prazo).
CREATE TABLE IF NOT EXISTS "DeliveryFeedback" (
    "id"             TEXT NOT NULL,
    "companyId"      TEXT NOT NULL,
    "orderSource"    TEXT NOT NULL,
    "orderId"        TEXT NOT NULL,
    "customerPhone"  TEXT NOT NULL,
    "customerName"   TEXT,
    "requestedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt"    TIMESTAMP(3),
    "responseText"   TEXT,
    "sentiment"      TEXT,
    "reviewLinkSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryFeedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DeliveryFeedback_orderSource_orderId_key"
    ON "DeliveryFeedback"("orderSource", "orderId");

CREATE INDEX IF NOT EXISTS "DeliveryFeedback_companyId_respondedAt_idx"
    ON "DeliveryFeedback"("companyId", "respondedAt");

CREATE INDEX IF NOT EXISTS "DeliveryFeedback_companyId_customerPhone_idx"
    ON "DeliveryFeedback"("companyId", "customerPhone");
