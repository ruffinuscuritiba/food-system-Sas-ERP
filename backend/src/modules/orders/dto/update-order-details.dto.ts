import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum PaymentMethodDto {
  CASH = 'CASH',
  PIX = 'PIX',
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  TRANSFER = 'TRANSFER',
}

export enum OrderTypeDto {
  DELIVERY = 'DELIVERY',
  DINE_IN = 'DINE_IN',
  PICKUP = 'PICKUP',
}

/**
 * Edição pós-criação: forma de pagamento (ex: cliente informou errado na
 * hora do pedido e só descobriu o certo na retirada/entrega) e conversão de
 * tipo (retirada -> entrega, recalculando a taxa automaticamente pela zona
 * do bairro). Nunca edita itens/preço dos produtos, só esses dois campos.
 */
export class UpdateOrderDetailsDto {
  @IsOptional()
  @IsEnum(PaymentMethodDto)
  paymentMethod?: PaymentMethodDto;

  @IsOptional()
  @IsEnum(OrderTypeDto)
  orderType?: OrderTypeDto;

  @IsOptional()
  @IsString()
  deliveryAddress?: string;

  @IsOptional()
  @IsString()
  neighborhood?: string;
}
