import { IsString, IsOptional, IsInt, Min, MaxLength } from 'class-validator';

export class CreateCampaignDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  // Suporta {{nome}} — substituído pelo nome do cliente no envio.
  @IsString()
  @MaxLength(1000)
  message!: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  minIntervalDays?: number;
}
