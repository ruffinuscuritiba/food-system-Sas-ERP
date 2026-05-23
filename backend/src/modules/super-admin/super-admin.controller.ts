import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Param,
  Post,
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
  listCompanies() {
    return this.service.listCompanies()
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
}
