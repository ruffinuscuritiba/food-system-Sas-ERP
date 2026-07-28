-- Idempotente: campo novo pro Container ID do Google Tag Manager (GTM-XXXXXXX)
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "googleTagManagerId" TEXT;
