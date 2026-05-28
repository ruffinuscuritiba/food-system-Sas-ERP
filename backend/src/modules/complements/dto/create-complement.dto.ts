import {
  IsString, IsOptional, IsBoolean, IsInt, IsEnum, Min,
} from 'class-validator';

// Mirror do enum Prisma — evita depender do client antes de `prisma generate`
export enum ComplementTypeEnum {
  INGREDIENTES   = 'INGREDIENTES',
  ESPECIFICACOES = 'ESPECIFICACOES',
  CROSS_SELL     = 'CROSS_SELL',
  DESCARTAVEIS   = 'DESCARTAVEIS',
}

export class CreateComplementDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsEnum(ComplementTypeEnum)
  @IsOptional()
  type?: ComplementTypeEnum;

  @IsBoolean()
  @IsOptional()
  required?: boolean;

  @IsBoolean()
  @IsOptional()
  chargesExtra?: boolean;

  @IsBoolean()
  @IsOptional()
  multipleChoice?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  minOptions?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  maxOptions?: number;

  @IsInt()
  @IsOptional()
  sortOrder?: number;
}
