import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator'
import { Transform } from 'class-transformer'

export class CreateProductDto {
  @IsString()
  name!: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  sku?: string

  @IsOptional()
  @IsString()
  barcode?: string

  @IsOptional()
  @IsString()
  unit?: string

  @IsOptional()
  @IsString()
  size?: string

  @IsOptional()
  @Transform(({ value }) => (value !== undefined && value !== '' ? parseFloat(value) : undefined))
  @IsNumber()
  weight?: number

  @IsOptional()
  @IsString()
  imageUrl?: string

  @IsOptional()
  @Transform(({ value }) => (value !== undefined && value !== '' ? parseFloat(value) : 0))
  @IsNumber()
  costPrice?: number

  @IsOptional()
  @Transform(({ value }) => (value !== undefined && value !== '' ? parseFloat(value) : 0))
  @IsNumber()
  profitMargin?: number

  @IsOptional()
  @Transform(({ value }) => (value !== undefined && value !== '' ? parseFloat(value) : 0))
  @IsNumber()
  salePrice?: number

  // Legacy alias — some forms still send "price"
  @IsOptional()
  @Transform(({ value }) => (value !== undefined && value !== '' ? parseFloat(value) : undefined))
  @IsNumber()
  price?: number

  @IsOptional()
  @IsString()
  categoryId?: string

  @IsOptional()
  @IsString()
  companyId?: string

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  trackStock?: boolean

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  allowNegativeStock?: boolean
}
