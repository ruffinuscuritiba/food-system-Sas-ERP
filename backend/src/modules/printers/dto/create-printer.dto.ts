import { IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { PrinterConnectionType, PrinterPaperWidth } from '@prisma/client';

export class CreatePrinterDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsEnum(PrinterConnectionType)
  connectionType?: PrinterConnectionType;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsEnum(PrinterPaperWidth)
  paperWidth?: PrinterPaperWidth;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
