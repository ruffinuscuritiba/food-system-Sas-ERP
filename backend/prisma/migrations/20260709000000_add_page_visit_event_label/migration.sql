-- Distingue page-views de cliques de botão/CTA no PageVisit, para o painel
-- super-admin conseguir rankear quais elementos convertem mais (/super-admin/visitas).
ALTER TABLE "PageVisit" ADD COLUMN IF NOT EXISTS "eventType" TEXT NOT NULL DEFAULT 'VIEW';
ALTER TABLE "PageVisit" ADD COLUMN IF NOT EXISTS "label" TEXT;
CREATE INDEX IF NOT EXISTS "PageVisit_eventType_label_idx" ON "PageVisit"("eventType", "label");
