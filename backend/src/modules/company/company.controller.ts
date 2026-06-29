import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CompanyService } from './company.service';
import { UpdateCompanySettingsDto } from './dto/update-settings.dto';
import { CompanyId } from '@/common/decorators/company-id.decorator';

@Controller('company')
export class CompanyController {
  constructor(private service: CompanyService) {}

  // ── Área de Configurações — rotas ANTES de ':id' para evitar match errado ──

  /** GET /company/layout/public?companyId=X — layout sem auth para PDV e cardápio */
  @Get('layout/public')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  getPublicLayout(@Query('companyId') companyId: string) {
    return this.service.getPublicLayout(companyId);
  }

  /** GET /company/settings — retorna dados de configuração da empresa logada */
  @Get('settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'DEMO')
  getSettings(@CompanyId() companyId: string) {
    return this.service.getSettings(companyId);
  }

  /** PATCH /company/settings — salva dados de configuração (patch parcial) */
  @Patch('settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  updateSettings(
    @CompanyId() companyId: string,
    @Body() dto: UpdateCompanySettingsDto,
  ) {
    return this.service.updateSettings(companyId, dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  /** Retorna plano + módulos ativos — usado pela página /assinatura */
  @Get(':id/subscription')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  getSubscription(@Param('id') id: string) {
    return this.service.getSubscription(id);
  }

  @Post()
  create(@Body() body: any) {
    return this.service.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  /** Atualiza apenas o plano (BASIC → PRO → ENTERPRISE). Nenhum módulo é removido. */
  @Patch(':id/plan')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  updatePlan(@Param('id') id: string, @Body() body: { plan: string }) {
    return this.service.updatePlan(id, body.plan);
  }

  @Patch(':id/block')
  block(@Param('id') id: string) {
    return this.service.blockCompany(id);
  }

  @Patch(':id/unblock')
  unblock(@Param('id') id: string) {
    return this.service.unblockCompany(id);
  }
}
