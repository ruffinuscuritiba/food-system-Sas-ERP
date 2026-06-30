import { IsString, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RedeemTokenDto {
  @IsString()
  token!: string;

  /** ID do OnlineOrder ou Order que foi finalizado */
  @IsString()
  orderId!: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  orderTotal!: number;

  /** Telefone do cliente — para enviar WhatsApp de boas-vindas */
  @IsString()
  @IsOptional()
  customerPhone?: string;

  /** Nome do cliente */
  @IsString()
  @IsOptional()
  customerName?: string;
}
