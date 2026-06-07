import { IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { PrinterRole } from '@prisma/client';

export class CreateProfileDto {
  @IsString()
  printerId!: string;

  @IsEnum(PrinterRole)
  role!: PrinterRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
