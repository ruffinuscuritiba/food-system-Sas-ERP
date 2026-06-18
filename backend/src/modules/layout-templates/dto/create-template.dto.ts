import { IsString, IsObject, IsOptional, IsBoolean } from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  segment?: string;

  @IsObject()
  config!: Record<string, unknown>;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

export class ApplyTemplateDto {
  @IsString()
  companyId!: string;
}
