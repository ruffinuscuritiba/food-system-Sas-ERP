import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export enum PaymentMethodDto {
  CASH = 'CASH',
  PIX = 'PIX',
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  TRANSFER = 'TRANSFER',
  MEAL_VOUCHER = 'MEAL_VOUCHER',
  SPLIT = 'SPLIT',
}

export enum OrderTypeDto {
  DELIVERY = 'DELIVERY',
  DINE_IN = 'DINE_IN',
  PICKUP = 'PICKUP',
}

/**
 * Edição pós-criação: forma de pagamento (ex: cliente informou errado na
 * hora do pedido e só descobriu o certo na retirada/entrega), conversão de
 * tipo (retirada -> entrega, recalculando a taxa automaticamente pela zona
 * do bairro) e desconto manual (ex: caixa não tinha troco e abateu a
 * diferença — precisa ajustar o pedido depois de já criado, não só na
 * abertura no PDV). Nunca edita itens/preço unitário dos produtos.
 */
export class UpdateOrderDetailsDto {
  @IsOptional()
  @IsEnum(PaymentMethodDto)
  paymentMethod?: PaymentMethodDto;

  // Só relevante quando paymentMethod=SPLIT — quanto da nova forma de
  // pagamento é dinheiro físico de verdade. Ausente = cai no fallback
  // histórico (CASH direto = total inteiro, outro método = 0).
  @IsOptional()
  @IsNumber()
  @Min(0)
  cashReceived?: number;

  @IsOptional()
  @IsEnum(OrderTypeDto)
  orderType?: OrderTypeDto;

  @IsOptional()
  @IsString()
  deliveryAddress?: string;

  @IsOptional()
  @IsString()
  neighborhood?: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;
}
