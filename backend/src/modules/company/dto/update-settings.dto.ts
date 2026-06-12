import {
  IsString,
  IsOptional,
  IsObject,
  ValidateNested,
  IsBoolean,
  IsNumber,
  Min,
  Matches,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BusinessHoursDayDto {
  @IsString()
  open!: string; // "HH:MM"

  @IsString()
  close!: string; // "HH:MM"

  @IsBoolean()
  isOpen!: boolean;
}

export class UpdateCompanySettingsDto {
  // ── Dados básicos ──────────────────────────────────────────────────────────
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  whatsapp?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  cnpj?: string;

  @IsString()
  @IsOptional()
  razaoSocial?: string;

  // ── Endereço ───────────────────────────────────────────────────────────────
  @IsString()
  @IsOptional()
  @Matches(/^\d{5}-?\d{3}$/, { message: 'CEP inválido' })
  zipCode?: string;

  @IsString()
  @IsOptional()
  street?: string;

  @IsString()
  @IsOptional()
  streetNumber?: string;

  @IsString()
  @IsOptional()
  complement?: string;

  @IsString()
  @IsOptional()
  neighborhood?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  @Length(2, 2)
  state?: string;

  // ── Horários — chaves "0"…"6" (dom…sáb) ──────────────────────────────────
  @IsObject()
  @IsOptional()
  businessHours?: Record<string, BusinessHoursDayDto>;

  // ── Configurações globais de entrega ──────────────────────────────────────
  @IsString()
  @IsOptional()
  deliveryMethod?: string; // NEIGHBORHOOD | RADIUS | ROUTE

  @IsNumber()
  @Min(0)
  @IsOptional()
  freeDeliveryAbove?: number | null;

  @IsBoolean()
  @IsOptional()
  ownDelivery?: boolean;

  @IsNumber()
  @Min(1)
  @IsOptional()
  maxDeliveryRadius?: number | null;

  @IsNumber()
  @IsOptional()
  storeLat?: number | null;

  @IsNumber()
  @IsOptional()
  storeLng?: number | null;

  // ── Formas de pagamento na entrega ──────────────────────────────────────
  @IsBoolean()
  @IsOptional()
  acceptCash?: boolean;

  @IsBoolean()
  @IsOptional()
  acceptCreditCard?: boolean;

  @IsBoolean()
  @IsOptional()
  acceptDebitCard?: boolean;

  @IsBoolean()
  @IsOptional()
  acceptMealVoucher?: boolean;

  @IsObject()
  @IsOptional()
  customPaymentMethods?: object;

  // ── Configurações de impressão ──────────────────────────────────────────
  @IsObject()
  @IsOptional()
  printingSettings?: object;
}
