import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { FinancialService } from './financial.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { ModuleGuard } from 'src/modules/auth/module.guard';
import { Module } from 'src/modules/auth/module.decorator';

@Controller('financial')
@UseGuards(JwtAuthGuard, RolesGuard, ModuleGuard)
@Module('FINANCIAL')
export class FinancialController {
  constructor(private service: FinancialService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  findAll(@Request() req: any) {
    return this.service.findAll(req.user.companyId);
  }

  @Get('summary')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  summary(@Request() req: any) {
    return this.service.summary(req.user.companyId);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  create(@Body() body: any, @Request() req: any) {
    return this.service.create({ ...body, companyId: req.user.companyId });
  }
}
