import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsEnum,
  Min,
} from 'class-validator';

// Mirror do enum Prisma — evita depender do client antes de `prisma generate`
export enum ComplementTypeEnum {
  INGREDIENTES = 'INGREDIENTES',
  ESPECIFICACOES = 'ESPECIFICACOES',
  CROSS_SELL = 'CROSS_SELL',
  DESCARTAVEIS = 'DESCARTAVEIS',
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

  // FIX: o frontend envia esse campo ao criar/editar um grupo de
  // complementos (existe na tabela Complement, com @default(true)), mas
  // faltava aqui no DTO. Como o ValidationPipe global usa whitelist +
  // forbidNonWhitelisted, qualquer campo não declarado aqui derruba a
  // requisição inteira com 400 "property isActive should not exist".
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

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