import {
  IsString, IsEnum, IsNumber, IsBoolean,
  IsOptional, IsDateString, IsPositive, Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum CampaignType {
  RECUPERACAO_IFOOD = 'RECUPERACAO_IFOOD',
  FIDELIZACAO       = 'FIDELIZACAO',
  CASHBACK          = 'CASHBACK',
  PRIMEIRA_COMPRA   = 'PRIMEIRA_COMPRA',
}

export enum DiscountType {
  PERCENTUAL = 'PERCENTUAL',
  FIXO       = 'FIXO',
}

export class CreateCampaignDto {
  @IsString()
  name!: string;

  @IsEnum(CampaignType)
  type!: CampaignType;

  @IsEnum(DiscountType)
  discountType!: DiscountType;

  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  discountValue!: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  minimumOrder?: number;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  @Type(() => Number)
  limitPerCustomer?: number;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  @Type(() => Number)
  limitPerDevice?: number;

  @IsBoolean()
  @IsOptional()
  status?: boolean;
}
