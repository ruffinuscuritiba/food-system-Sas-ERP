-- ── QR Code Recovery Campaigns — migration idempotente ───────────────────────

-- Enums (idempotente via DO $$)
DO $$ BEGIN
  CREATE TYPE "CampaignType" AS ENUM ('RECUPERACAO_IFOOD','FIDELIZACAO','CASHBACK','PRIMEIRA_COMPRA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DiscountType" AS ENUM ('PERCENTUAL','FIXO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela Campaign
CREATE TABLE IF NOT EXISTS "Campaign" (
  "id"               TEXT NOT NULL DEFAULT gen_random_uuid(),
  "companyId"        TEXT NOT NULL,
  "name"             TEXT NOT NULL,
  "type"             "CampaignType" NOT NULL,
  "discountType"     "DiscountType" NOT NULL,
  "discountValue"    DECIMAL(10,2) NOT NULL,
  "minimumOrder"     DECIMAL(10,2) NOT NULL DEFAULT 0,
  "startsAt"         TIMESTAMP(3) NOT NULL,
  "endsAt"           TIMESTAMP(3) NOT NULL,
  "limitPerCustomer" INTEGER,
  "limitPerDevice"   INTEGER,
  "status"           BOOLEAN NOT NULL DEFAULT true,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "Campaign_companyId_status_idx" ON "Campaign"("companyId", "status");
CREATE INDEX IF NOT EXISTS "Campaign_type_idx" ON "Campaign"("type");

-- Tabela QrCode
CREATE TABLE IF NOT EXISTS "QrCode" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid(),
  "companyId"   TEXT NOT NULL,
  "campaignId"  TEXT NOT NULL,
  "customerId"  TEXT,
  "orderId"     TEXT,
  "orderSource" TEXT NOT NULL DEFAULT 'PROPRIO',
  "token"       TEXT NOT NULL,
  "qrUrl"       TEXT NOT NULL,
  "used"        BOOLEAN NOT NULL DEFAULT false,
  "usedAt"      TIMESTAMP(3),
  "expiresAt"   TIMESTAMP(3) NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QrCode_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "QrCode" ADD CONSTRAINT "QrCode_token_key" UNIQUE ("token");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "QrCode" ADD CONSTRAINT "QrCode_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "QrCode" ADD CONSTRAINT "QrCode_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "QrCode_token_key" ON "QrCode"("token");
CREATE INDEX IF NOT EXISTS "QrCode_companyId_idx" ON "QrCode"("companyId");
CREATE INDEX IF NOT EXISTS "QrCode_used_idx" ON "QrCode"("used");
CREATE INDEX IF NOT EXISTS "QrCode_expiresAt_idx" ON "QrCode"("expiresAt");

-- Tabela CouponRedemption
CREATE TABLE IF NOT EXISTS "CouponRedemption" (
  "id"         TEXT NOT NULL DEFAULT gen_random_uuid(),
  "companyId"  TEXT NOT NULL,
  "qrCodeId"   TEXT NOT NULL,
  "orderId"    TEXT NOT NULL,
  "orderTotal" DECIMAL(10,2) NOT NULL,
  "discount"   DECIMAL(10,2) NOT NULL,
  "ip"         TEXT NOT NULL,
  "userAgent"  TEXT NOT NULL,
  "device"     TEXT NOT NULL DEFAULT 'UNKNOWN',
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_qrCodeId_fkey"
    FOREIGN KEY ("qrCodeId") REFERENCES "QrCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "CouponRedemption_companyId_idx" ON "CouponRedemption"("companyId");
CREATE INDEX IF NOT EXISTS "CouponRedemption_qrCodeId_idx" ON "CouponRedemption"("qrCodeId");
CREATE INDEX IF NOT EXISTS "CouponRedemption_createdAt_idx" ON "CouponRedemption"("createdAt");
