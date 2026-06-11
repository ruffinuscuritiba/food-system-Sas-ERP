import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { CompanyModuleService } from './company-module.service';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';

@Controller('company-module')
export class CompanyModuleController {
  constructor(private service: CompanyModuleService) {}

  @Get('catalog')
  getCatalog() {
    return this.service.getCatalog();
  }

  // ── Admin endpoints (SUPER_ADMIN ou empresa matriz) ─────────────────────────

  /** Lista empresas para o seletor de provisionamento cross-tenant. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Get('admin/companies')
  listCompanies(@Request() req: any) {
    return this.service.listCompaniesForAdmin(req.user.companyId, req.user.role);
  }

  /** Ativa um módulo em qualquer empresa (cross-tenant). */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Post('admin/activate')
  adminActivate(
    @Body() body: { targetCompanyId: string; moduleSlug: string },
    @Request() req: any,
  ) {
    return this.service.adminActivate(
      req.user.companyId,
      req.user.role,
      body.targetCompanyId,
      body.moduleSlug,
    );
  }

  // ── Endpoints da própria empresa ───────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('company/:companyId')
  getCompanyModules(@Param('companyId') companyId: string) {
    return this.service.getCompanyModules(companyId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('trial')
  startTrial(@Body() body: { companyId: string; moduleSlug: string }) {
    return this.service.startTrial(body.companyId, body.moduleSlug);
  }

  @UseGuards(JwtAuthGuard)
  @Post('activate')
  activateModule(@Body() body: { companyId: string; moduleSlug: string }) {
    return this.service.activateModule(body.companyId, body.moduleSlug);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':companyId/:moduleSlug')
  deactivateModule(
    @Param('companyId') companyId: string,
    @Param('moduleSlug') moduleSlug: string,
  ) {
    return this.service.deactivateModule(companyId, moduleSlug);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  create(@Body() body: any) {
    return this.service.create(body);
  }
}
