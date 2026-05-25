-- CreateEnum
CREATE TYPE "OnlineOrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERING', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "OnlinePaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REFUNDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OnlinePaymentMethod" AS ENUM ('PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH');

-- CreateTable
CREATE TABLE "OnlineOrder" (
    "id"                      TEXT NOT NULL,
    "companyId"               TEXT NOT NULL,
    "customerName"            TEXT NOT NULL,
    "customerPhone"           TEXT NOT NULL,
    "customerEmail"           TEXT,
    "orderType"               "OrderType" NOT NULL DEFAULT 'DELIVERY',
    "address"                 TEXT,
    "addressNumber"           TEXT,
    "neighborhood"            TEXT,
    "city"                    TEXT,
    "state"                   TEXT,
    "zipcode"                 TEXT,
    "complement"              TEXT,
    "items"                   JSONB NOT NULL,
    "subtotal"                DECIMAL(10,2) NOT NULL,
    "deliveryFee"             DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discount"                DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total"                   DECIMAL(10,2) NOT NULL,
    "paymentMethod"           "OnlinePaymentMethod" NOT NULL DEFAULT 'PIX',
    "paymentGateway"          TEXT NOT NULL DEFAULT 'MERCADOPAGO',
    "paymentStatus"           "OnlinePaymentStatus" NOT NULL DEFAULT 'PENDING',
    "orderStatus"             "OnlineOrderStatus" NOT NULL DEFAULT 'PENDING',
    "mercadopagoPaymentId"    TEXT,
    "mercadopagoPreferenceId" TEXT,
    "pixQrcode"               TEXT,
    "pixCopyPaste"            TEXT,
    "pixExpiresAt"            TIMESTAMP(3),
    "notes"                   TEXT,
    "paidAt"                  TIMESTAMP(3),
    "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"               TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnlineOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentWebhook" (
    "id"        TEXT NOT NULL,
    "companyId" TEXT,
    "gateway"   TEXT NOT NULL,
    "eventId"   TEXT NOT NULL,
    "event"     TEXT NOT NULL,
    "payload"   JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OnlineOrder_companyId_idx" ON "OnlineOrder"("companyId");
CREATE INDEX "OnlineOrder_paymentStatus_idx" ON "OnlineOrder"("paymentStatus");
CREATE INDEX "OnlineOrder_orderStatus_idx" ON "OnlineOrder"("orderStatus");
CREATE INDEX "OnlineOrder_mercadopagoPaymentId_idx" ON "OnlineOrder"("mercadopagoPaymentId");
CREATE INDEX "OnlineOrder_createdAt_idx" ON "OnlineOrder"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentWebhook_gateway_eventId_key" ON "PaymentWebhook"("gateway", "eventId");
CREATE INDEX "PaymentWebhook_processed_idx" ON "PaymentWebhook"("processed");
CREATE INDEX "PaymentWebhook_companyId_idx" ON "PaymentWebhook"("companyId");

-- AddForeignKey
ALTER TABLE "OnlineOrder" ADD CONSTRAINT "OnlineOrder_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
