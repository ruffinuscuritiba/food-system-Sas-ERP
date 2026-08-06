-- Adiciona SPLIT ao enum PaymentMethod + Order.cashReceived.
--
-- Bug real corrigido junto com este migration: pagamento dividido no PDV
-- (ex: parte em Dinheiro + parte em PIX) mandava pro backend só o método do
-- 1º split como se fosse o pagamento inteiro (order.paymentMethod). Resultado:
-- se Dinheiro caísse em 1º lugar no split, o TOTAL do pedido era creditado no
-- caixa físico (contando de mais o que era PIX/cartão); se caísse em 2º/3º,
-- a parte em dinheiro nunca era creditada (caixa ficava faltando dinheiro que
-- entrou de verdade). cashReceived resolve isso guardando quanto do total foi
-- de fato pago em espécie, independente de quantos métodos o split usou —
-- orders.service.ts credita/debita só esse valor, nunca o total inteiro,
-- exceto quando cashReceived vier vazio (fallback: paymentMethod=CASH direto,
-- sem split, continua creditando o total como sempre foi).
--
-- ALTER TYPE ADD VALUE não pode ser encapsulado em transação no PostgreSQL,
-- por isso o DO $$ com verificação prévia (mesmo padrão de add_meal_voucher_payment).

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN  pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'PaymentMethod'
          AND e.enumlabel = 'SPLIT'
    ) THEN
        ALTER TYPE "PaymentMethod" ADD VALUE 'SPLIT';
    END IF;
END $$;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "cashReceived" DECIMAL(10,2);
