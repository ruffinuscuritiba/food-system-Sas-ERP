import { IsString, IsNumber, IsPositive, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ValidateTokenDto {
  @IsString()
  token!: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  subtotal!: number;
}
