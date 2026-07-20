-- MenuAnalyticsEvent: visualizações do cardápio digital e de produtos, por
-- loja — alimenta o painel "Tráfego Pago" (idempotente).
CREATE TABLE IF NOT EXISTS "MenuAnalyticsEvent" (
  "id"        TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "type"      TEXT NOT NULL,
  "productId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MenuAnalyticsEvent_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MenuAnalyticsEvent_companyId_fkey') THEN
    ALTER TABLE "MenuAnalyticsEvent" ADD CONSTRAINT "MenuAnalyticsEvent_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "MenuAnalyticsEvent_companyId_type_createdAt_idx" ON "MenuAnalyticsEvent"("companyId", "type", "createdAt");
CREATE INDEX IF NOT EXISTS "MenuAnalyticsEvent_companyId_productId_idx" ON "MenuAnalyticsEvent"("companyId", "productId");
