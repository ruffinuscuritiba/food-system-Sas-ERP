-- Adiciona MEAL_VOUCHER (Vale-Refeição/Alimentação — VR/VA/Alelo/Sodexo/Ticket)
-- ao enum PaymentMethod. A loja já tinha o toggle "Vale-Refeição" em
-- Configurações > Pagamento (Company.acceptMealVoucher, item 111) mas não
-- existia nenhum valor de enum pra de fato registrar um pedido pago dessa
-- forma — o seletor de forma de pagamento (PDV, edição de pedido, fechar
-- conta de mesa) só oferecia CASH/PIX/CREDIT_CARD/DEBIT_CARD/TRANSFER.
--
-- ALTER TYPE ADD VALUE não pode ser encapsulado em transação no PostgreSQL,
-- portanto usamos DO $$ com verificação prévia (mesmo padrão de
-- add_demo_role / add_99food_provider).

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN  pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'PaymentMethod'
          AND e.enumlabel = 'MEAL_VOUCHER'
    ) THEN
        ALTER TYPE "PaymentMethod" ADD VALUE 'MEAL_VOUCHER';
    END IF;
END $$;
