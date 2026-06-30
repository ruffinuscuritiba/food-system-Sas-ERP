-- Migration idempotente: adiciona campos usedByPhone e usedByCustomer ao QrCode
ALTER TABLE "QrCode" ADD COLUMN IF NOT EXISTS "usedByPhone"    TEXT;
ALTER TABLE "QrCode" ADD COLUMN IF NOT EXISTS "usedByCustomer" TEXT;
