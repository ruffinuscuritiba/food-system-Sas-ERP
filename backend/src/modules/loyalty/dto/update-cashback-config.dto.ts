import { IsBoolean, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateCashbackConfigDto {
  @IsNumber()
  @Min(0)
  @Max(20)
  @IsOptional()
  ratePercent?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
