import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CompanyService } from './company.service';

@Controller('company')
export class CompanyController {
  constructor(private service: CompanyService) {}

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
