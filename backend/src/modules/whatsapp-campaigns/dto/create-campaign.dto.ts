import { IsString, IsOptional, IsInt, Min, Max, MaxLength } from 'class-validator';

// Limites de gotejamento por lote — min evita ativações inúteis (1-2 por
// vez), max evita a plataforma virar ferramenta de disparo em massa.
export const MAX_PER_RUN_MIN = 10;
export const MAX_PER_RUN_MAX = 500;

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

  // Quantos contatos recebem mensagem por ativação (gotejamento). Padrão 50.
  @IsInt()
  @Min(MAX_PER_RUN_MIN)
  @Max(MAX_PER_RUN_MAX)
  @IsOptional()
  maxPerRun?: number;
}

export class UpdateCampaignDto {
  @IsString()
  @MaxLength(80)
  @IsOptional()
  name?: string;

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  message?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  minIntervalDays?: number;

  @IsInt()
  @Min(MAX_PER_RUN_MIN)
  @Max(MAX_PER_RUN_MAX)
  @IsOptional()
  maxPerRun?: number;
}
