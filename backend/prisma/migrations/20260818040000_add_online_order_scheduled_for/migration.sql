-- Migration: add_online_order_scheduled_for
-- Idempotente — ADD COLUMN IF NOT EXISTS.

ALTER TABLE "OnlineOrder"
  ADD COLUMN IF NOT EXISTS "scheduledFor" TIMESTAMP(3);
