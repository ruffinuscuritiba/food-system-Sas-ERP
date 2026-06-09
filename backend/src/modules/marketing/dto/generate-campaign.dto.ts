import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GenerateCampaignDto {
  @IsString()
  @IsNotEmpty()
  tipoNegocio!: string;

  @IsString()
  @IsNotEmpty()
  objetivo!: string;

  @IsString()
  @IsNotEmpty()
  produto!: string;

  @IsString()
  @IsNotEmpty()
  precoDe!: string;

  @IsString()
  @IsOptional()
  precoPor?: string;

  @IsString()
  @IsNotEmpty()
  tomVoz!: string;

  @IsString()
  @IsOptional()
  contextoExtra?: string;
}
