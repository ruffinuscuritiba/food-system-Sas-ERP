import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { SuperAdminService } from './super-admin.service';
import { SuperAdminGuard } from './super-admin.guard';
import { DemoVitrineService } from './demo-vitrine.service';
import { LeadsService } from '../leads/leads.service';
import { CompanyService } from '../company/company.service';
import { UpdateCompanySettingsDto } from '../company/dto/update-settings.dto';
import { PrismaService } from '@/database/prisma.service';
import { PLATFORM_SELLER_COMPANY_ID } from '@/common/utils/matrix';

// Empresa dedicada de identidade/marca da plataforma (ex: Mestra Gestão
// Digital) — separada da loja real "Ruffinu's Pizzaria" (MATRIX_COMPANY_ID).
const PLATFORM_COMPANY_ID = PLATFORM_SELLER_COMPANY_ID;

@Controller('super-admin')
export class SuperAdminController {
  constructor(
    private service: SuperAdminService,
    private vitrine: DemoVitrineService,
    private leads: LeadsService,
    private companyService: CompanyService,
    private prisma: PrismaService,
  ) {}

  @Get('platform/settings')
  @UseGuards(SuperAdminGuard)
  getPlatformSettings() {
    return this.companyService.getSettings(PLATFORM_COMPANY_ID);
  }

  @Patch('platform/settings')
  @UseGuards(SuperAdminGuard)
  updatePlatformSettings(@Body() dto: UpdateCompanySettingsDto) {
    return this.companyService.updateSettings(PLATFORM_COMPANY_ID, dto);
  }

  /**
   * POST /api/super-admin/platform/move-whatsapp-connection
   * One-off/idempotent: reassigns a WhatsappConnection (+ suas settings) para
   * outra empresa. Usado para mover a conexão de vendas da Kely da loja real
   * (matrix) para a empresa dedicada de identidade da plataforma.
   */
  @Post('platform/move-whatsapp-connection')
  @UseGuards(SuperAdminGuard)
  async moveWhatsappConnection(
    @Body() body: { connectionId: string; targetCompanyId: string },
  ) {
    const { connectionId, targetCompanyId } = body;
    const target = await this.prisma.company.findUnique({
      where: { id: targetCompanyId },
      select: { id: true },
    });
    if (!target) {
      return { ok: false, error: 'Empresa de destino não encontrada' };
    }
    const connection = await this.prisma.whatsappConnection.update({
      where: { id: connectionId },
      data: { companyId: targetCompanyId },
    });
    await this.prisma.whatsappAiSettings.updateMany({
      where: { connectionId },
      data: { companyId: targetCompanyId },
    });
    return { ok: true, connection };
  }

  @Post('auth/login')
  login(@Body() body: { email: string; password: string }) {
    return this.service.login(body.email, body.password);
  }

  @Get('stats')
  @UseGuards(SuperAdminGuard)
  getStats() {
    return this.service.getStats();
  }

  @Get('companies')
  @UseGuards(SuperAdminGuard)
  listCompanies(@Query('showArchived') showArchived?: string) {
    return this.service.listCompanies(showArchived === 'true');
  }

  @Post('companies')
  @UseGuards(SuperAdminGuard)
  createCompany(
    @Body()
    body: {
      name: string;
      email: string;
      adminPassword: string;
      plan?: string;
      phone?: string;
    },
  ) {
    return this.service.createCompany(body);
  }

  @Patch('companies/:id/block')
  @UseGuards(SuperAdminGuard)
  toggleBlock(@Param('id') id: string) {
    return this.service.toggleBlock(id);
  }

  @Patch('companies/:id/archive')
  @UseGuards(SuperAdminGuard)
  archiveCompany(@Param('id') id: string) {
    return this.service.archiveCompany(id);
  }

  @Patch('companies/:id/restore')
  @UseGuards(SuperAdminGuard)
  restoreCompany(@Param('id') id: string) {
    return this.service.restoreCompany(id);
  }

  @Post('platform/impersonate')
  @UseGuards(SuperAdminGuard)
  getPlatformImpersonation() {
    return this.service.getPlatformImpersonation();
  }

  @Post('companies/:id/impersonate')
  @UseGuards(SuperAdminGuard)
  impersonateCompany(@Param('id') id: string) {
    return this.service.impersonateCompany(id);
  }

  @Delete('companies/:id')
  @UseGuards(SuperAdminGuard)
  deleteCompany(@Param('id') id: string) {
    return this.service.deleteCompany(id);
  }

  @Post('companies/:id/clone-menu')
  @UseGuards(SuperAdminGuard)
  cloneMenu(@Param('id') targetId: string, @Body() body: { sourceId: string }) {
    return this.service.cloneMenu(body.sourceId, targetId);
  }

  @Post('seed')
  @UseGuards(SuperAdminGuard)
  runSeed() {
    return this.service.runDemoSeed();
  }

  @Post('companies/:id/fix-modules')
  @UseGuards(SuperAdminGuard)
  fixModules(@Param('id') id: string) {
    return this.service.fixModules(id);
  }

  /**
   * POST /api/super-admin/demo/init
   * Cria (ou atualiza) as 3 empresas de demonstração com usuários DEMO.
   * Retorna as credenciais e tokens JWT de cada conta.
   */
  @Post('demo/init')
  @UseGuards(SuperAdminGuard)
  initDemoCompanies() {
    return this.service.initDemoCompanies();
  }

  // ── Precificação ────────────────────────────────────────────────────────────

  @Get('plan-config')
  @UseGuards(SuperAdminGuard)
  getPlanConfig() {
    return this.service.getPlanConfig();
  }

  @Patch('plan-config/:plan')
  @UseGuards(SuperAdminGuard)
  updatePlanConfig(
    @Param('plan') plan: string,
    @Body() body: { price?: number; label?: string; tagline?: string },
  ) {
    return this.service.updatePlanConfig(plan, body);
  }

  @Get('modules')
  @UseGuards(SuperAdminGuard)
  listModuleCatalog() {
    return this.service.listModuleCatalog();
  }

  @Patch('modules/:slug/price')
  @UseGuards(SuperAdminGuard)
  updateModulePrice(
    @Param('slug') slug: string,
    @Body() body: { price: number; isFree?: boolean },
  ) {
    return this.service.updateModulePrice(slug, body.price, body.isFree);
  }

  /** POST /api/super-admin/demo/vitrine — popula as 3 demos com dados realistas */
  @Post('demo/vitrine')
  @UseGuards(SuperAdminGuard)
  populateVitrine() {
    return this.vitrine.populateAll();
  }

  /** GET /api/super-admin/leads/stats — KPIs de leads da Kely */
  @Get('leads/stats')
  @UseGuards(SuperAdminGuard)
  leadsStats() {
    return this.leads.getStats();
  }

  /** GET /api/super-admin/leads — lista todos os leads capturados pela Kely */
  @Get('leads')
  @UseGuards(SuperAdminGuard)
  listLeads() {
    return this.leads.findAll();
  }

  // ── Customers Report ─────────────────────────────────────────────────────────

  /** GET /api/super-admin/cash-status — status de caixa (aberto/fechado) por tenant */
  @Get('cash-status')
  @UseGuards(SuperAdminGuard)
  cashStatus() {
    return this.service.getCashStatusReport();
  }

  /** GET /api/super-admin/customers-report/csv — download CSV */
  @Get('customers-report/csv')
  @UseGuards(SuperAdminGuard)
  async customersReportCsv(@Res() res: Response) {
    const csv = await this.service.getCustomersReportCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="foodsaas-clientes.csv"');
    res.send('﻿' + csv); // UTF-8 BOM for Excel
  }

  /** GET /api/super-admin/customers-report/txt — download TXT (apenas WhatsApps) */
  @Get('customers-report/txt')
  @UseGuards(SuperAdminGuard)
  async customersReportTxt(@Res() res: Response) {
    const txt = await this.service.getCustomersReportTxt();
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="foodsaas-whatsapps.txt"');
    res.send(txt);
  }

  /** GET /api/super-admin/customers-report — JSON paginado */
  @Get('customers-report')
  @UseGuards(SuperAdminGuard)
  customersReport(
    @Query('page')   page?:   string,
    @Query('limit')  limit?:  string,
    @Query('type')   type?:   string,
    @Query('search') search?: string,
  ) {
    return this.service.getCustomersReport({
      page:   page   ? parseInt(page)  : undefined,
      limit:  limit  ? parseInt(limit) : undefined,
      type:   type   || 'ALL',
      search: search || '',
    });
  }

  /** POST /api/super-admin/retention/run — disparo manual do cron de retenção */
  @Post('retention/run')
  @UseGuards(SuperAdminGuard)
  async runRetention() {
    // Dynamically access RetentionService to avoid circular dep in module
    return { ok: true, message: 'Use o cron diário ou acesse o log do servidor para ver a execução.' };
  }
}
