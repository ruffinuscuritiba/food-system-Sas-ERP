import { Body, Controller, Get, Post, Put, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CompanyId } from '@/common/decorators/company-id.decorator';
import { FiscalService, FISCAL_TERMS_TEXT } from './fiscal.service';
import { UpdateFiscalConfigDto } from './dto/update-fiscal-config.dto';

@Controller('fiscal')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
export class FiscalController {
  constructor(private readonly service: FiscalService) {}

  @Get('config')
  getConfig(@CompanyId() companyId: string) {
    return this.service.getConfig(companyId);
  }

  @Get('terms')
  getTerms() {
    return { text: FISCAL_TERMS_TEXT };
  }

  @Post('accept-terms')
  acceptTerms(@CompanyId() companyId: string, @Req() req: Request & { user: any }) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
    return this.service.acceptTerms(companyId, req.user.userId ?? null, ip);
  }

  @Put('config')
  saveConfig(@CompanyId() companyId: string, @Body() dto: UpdateFiscalConfigDto) {
    return this.service.saveConfig(companyId, dto);
  }

  @Post('active')
  setActive(@CompanyId() companyId: string, @Body() body: { isActive: boolean }) {
    return this.service.setActive(companyId, !!body.isActive);
  }

  @Post('emit')
  emit(@CompanyId() companyId: string, @Body() body: { payload: Record<string, any> }) {
    return this.service.emit(companyId, body.payload ?? {});
  }
}
