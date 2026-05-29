import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateConnectionDto {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  provider?: string; // EVOLUTION | CLOUD_API | ZAPI | TWILIO

  @IsString()
  @IsOptional()
  instanceName?: string;

  @IsString()
  @IsOptional()
  apiUrl?: string;

  @IsString()
  @IsOptional()
  apiToken?: string;

  @IsString()
  @IsOptional()
  phoneNumberId?: string;

  @IsString()
  @IsOptional()
  webhookToken?: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
