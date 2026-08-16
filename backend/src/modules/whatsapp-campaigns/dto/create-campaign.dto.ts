import { IsString, IsOptional, IsInt, Min, Max, MaxLength, IsIn } from 'class-validator';

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

  // Data URL base64 (ImageUploaderPreview já comprime client-side) ou https
  // URL. Opcional — sem imagem, envia só texto (comportamento original).
  @IsString()
  @MaxLength(5_000_000)
  @IsOptional()
  imageUrl?: string;

  // MANUAL (padrão) = dispara uma vez ao clicar "Ativar". INACTIVE_CUSTOMERS
  // = campanha de reengajamento que roda sozinha todo dia (cron), enquanto
  // status=ACTIVE, recalculando quem "sumiu" a cada execução.
  @IsIn(['MANUAL', 'INACTIVE_CUSTOMERS'])
  @IsOptional()
  triggerType?: string;

  // Só relevante quando triggerType=INACTIVE_CUSTOMERS.
  @IsInt()
  @Min(1)
  @Max(365)
  @IsOptional()
  inactiveDaysThreshold?: number;
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

  @IsString()
  @MaxLength(5_000_000)
  @IsOptional()
  imageUrl?: string;

  @IsIn(['MANUAL', 'INACTIVE_CUSTOMERS'])
  @IsOptional()
  triggerType?: string;

  @IsInt()
  @Min(1)
  @Max(365)
  @IsOptional()
  inactiveDaysThreshold?: number;
}
