import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsNumber,
  Min,
} from 'class-validator';

export class CreateComplementOptionDto {
  @IsString()
  name!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  price?: number;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsInt()
  @IsOptional()
  sortOrder?: number;
}
