import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CompanyModuleService } from './company-module.service';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';

@Controller('company-module')
export class CompanyModuleController {
  constructor(private service: CompanyModuleService) {}

  @Get('catalog')
  getCatalog() {
    return this.service.getCatalog();
  }

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
  deactivateModule(@Param('companyId') companyId: string, @Param('moduleSlug') moduleSlug: string) {
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
