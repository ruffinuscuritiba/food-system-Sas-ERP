import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { SuperAdminService } from './super-admin.service'
import { SuperAdminGuard } from './super-admin.guard'

@Controller('super-admin')
export class SuperAdminController {
  constructor(private service: SuperAdminService) {}

  @Post('auth/login')
  login(@Body() body: { email: string; password: string }) {
    return this.service.login(body.email, body.password)
  }

  @Get('stats')
  @UseGuards(SuperAdminGuard)
  getStats() {
    return this.service.getStats()
  }

  @Get('companies')
  @UseGuards(SuperAdminGuard)
  listCompanies(@Query('showArchived') showArchived?: string) {
    return this.service.listCompanies(showArchived === 'true')
  }

  @Post('companies')
  @UseGuards(SuperAdminGuard)
  createCompany(
    @Body()
    body: {
      name: string
      email: string
      adminPassword: string
      plan?: string
      phone?: string
    },
  ) {
    return this.service.createCompany(body)
  }

  @Patch('companies/:id/block')
  @UseGuards(SuperAdminGuard)
  toggleBlock(@Param('id') id: string) {
    return this.service.toggleBlock(id)
  }

  @Patch('companies/:id/archive')
  @UseGuards(SuperAdminGuard)
  archiveCompany(@Param('id') id: string) {
    return this.service.archiveCompany(id)
  }

  @Patch('companies/:id/restore')
  @UseGuards(SuperAdminGuard)
  restoreCompany(@Param('id') id: string) {
    return this.service.restoreCompany(id)
  }

  @Post('companies/:id/impersonate')
  @UseGuards(SuperAdminGuard)
  impersonateCompany(@Param('id') id: string) {
    return this.service.impersonateCompany(id)
  }

  @Delete('companies/:id')
  @UseGuards(SuperAdminGuard)
  deleteCompany(@Param('id') id: string) {
    return this.service.deleteCompany(id)
  }

  @Post('companies/:id/clone-menu')
  @UseGuards(SuperAdminGuard)
  cloneMenu(
    @Param('id') targetId: string,
    @Body() body: { sourceId: string },
  ) {
    return this.service.cloneMenu(body.sourceId, targetId)
  }

  @Post('seed')
  @UseGuards(SuperAdminGuard)
  runSeed() {
    return this.service.runDemoSeed()
  }

  @Post('companies/:id/fix-modules')
  @UseGuards(SuperAdminGuard)
  fixModules(@Param('id') id: string) {
    return this.service.fixModules(id)
  }

  /**
   * POST /api/super-admin/demo/init
   * Cria (ou atualiza) as 3 empresas de demonstração com usuários DEMO.
   * Retorna as credenciais e tokens JWT de cada conta.
   */
  @Post('demo/init')
  @UseGuards(SuperAdminGuard)
  initDemoCompanies() {
    return this.service.initDemoCompanies()
  }
}
