-- Link manual reutilizável de campanha (idempotente)
ALTER TABLE "QrCode" ADD COLUMN IF NOT EXISTS "isReusable" BOOLEAN NOT NULL DEFAULT false;
