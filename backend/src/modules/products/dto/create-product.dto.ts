import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator'

export class CreateProductDto {
  @IsString()
  name: string

  @IsOptional()
  @IsString()
  description?: string

  @IsNumber()
  price: number

  @IsOptional()
  @IsString()
  image?: string

  @IsUUID()
  categoryId: string

  @IsOptional()
  @IsBoolean()
  active?: boolean
}