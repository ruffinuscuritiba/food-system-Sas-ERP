import {
  Body, Controller, Delete, Get, Param, Patch, Post, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { Throttle } from '@nestjs/throttler';
import { LayoutTemplatesService } from './layout-templates.service';
import { ApplyTemplateDto, CreateTemplateDto } from './dto/create-template.dto';

@Controller('layout-templates')
export class LayoutTemplatesController {
  constructor(private service: LayoutTemplatesService) {}

  /** GET /layout-templates — lista todos os templates (autenticado). */
  @Get()
  @UseGuards(JwtAuthGuard)
  findAll() {
    return this.service.findAll();
  }

  /** POST /layout-templates — cria template customizado (super admin / admin). */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  create(@Body() dto: CreateTemplateDto) {
    return this.service.create(dto);
  }

  /** DELETE /layout-templates/:id */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }

  /** POST /layout-templates/:id/apply — aplica template a uma empresa. */
  @Post(':id/apply')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  apply(@Param('id') id: string, @Body() dto: ApplyTemplateDto) {
    return this.service.applyToCompany(id, dto.companyId);
  }

  /** PATCH /layout-templates/company/:companyId — salva layout customizado direto. */
  @Patch('company/:companyId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  saveCompanyLayout(
    @Param('companyId') companyId: string,
    @Body() config: Record<string, unknown>,
  ) {
    return this.service.saveCompanyLayout(companyId, config);
  }
}
