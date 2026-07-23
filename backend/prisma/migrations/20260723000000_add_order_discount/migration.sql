-- Order.discount: desconto manual aplicado no fechamento (ex: DiscountRow do
-- PDV), que o backend nunca lia — recalculava total=subtotal+deliveryFee do
-- zero, ignorando qualquer desconto aplicado pelo operador. Idempotente.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "discount" DECIMAL(10,2) NOT NULL DEFAULT 0;
