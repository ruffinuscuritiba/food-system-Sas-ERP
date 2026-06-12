-- Idempotent: add payment methods + printing settings to Company
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "acceptCash"            BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "acceptCreditCard"      BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "acceptDebitCard"       BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "acceptMealVoucher"     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "customPaymentMethods"  JSONB;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "printingSettings"      JSONB;
