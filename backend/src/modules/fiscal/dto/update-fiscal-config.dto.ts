import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateFiscalConfigDto {
  @IsOptional()
  @IsIn(['FOCUS_NFE'])
  provider?: string;

  @IsOptional()
  @IsIn(['HOMOLOGACAO', 'PRODUCAO'])
  environment?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  apiKey?: string;

  @IsOptional()
  @IsString()
  certFileBase64?: string;

  @IsOptional()
  @IsString()
  certPassword?: string;
}
