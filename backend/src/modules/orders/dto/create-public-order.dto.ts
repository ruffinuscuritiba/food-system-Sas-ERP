import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreatePublicOrderDto {
  @IsString()
  companyId!: string;

  @IsString()
  customerName!: string;

  @IsString()
  customerPhone!: string;

  @IsString()
  @IsOptional()
  deliveryAddress?: string;

  @IsEnum(['DELIVERY', 'PICKUP', 'DINE_IN'])
  @IsOptional()
  orderType?: string;

  @IsEnum(['PIX', 'CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'TRANSFER'])
  @IsOptional()
  paymentMethod?: string;

  @IsArray()
  items!: {
    productId: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    notes?: string;
  }[];

  @IsNumber()
  total!: number;
}
