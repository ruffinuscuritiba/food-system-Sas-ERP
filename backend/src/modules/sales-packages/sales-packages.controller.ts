import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { SalesPackagesService } from './sales-packages.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';

@Controller('sales-packages')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalesPackagesController {
  constructor(private readonly service: SalesPackagesService) {}

  // ── Pacotes ──
  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')
  list(@Request() req: any) {
    return this.service.listPackages(req.user.companyId);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  create(@Body() body: any, @Request() req: any) {
    return this.service.createPackage(req.user.companyId, body);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  update(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.service.updatePackage(id, req.user.companyId, body);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.service.deletePackage(id, req.user.companyId);
  }

  // ── Assinantes ──
  @Get('subscriptions')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')
  listSubscriptions(@Query('packageId') packageId: string, @Request() req: any) {
    return this.service.listSubscriptions(req.user.companyId, packageId);
  }

  @Post('subscriptions')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')
  subscribe(@Body() body: any, @Request() req: any) {
    return this.service.subscribe(req.user.companyId, body);
  }

  @Patch('subscriptions/:id/pause')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')
  pause(@Param('id') id: string, @Request() req: any) {
    return this.service.pauseSubscription(id, req.user.companyId);
  }

  @Patch('subscriptions/:id/resume')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')
  resume(@Param('id') id: string, @Request() req: any) {
    return this.service.resumeSubscription(id, req.user.companyId);
  }

  @Patch('subscriptions/:id/cancel')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')
  cancel(@Param('id') id: string, @Request() req: any) {
    return this.service.cancelSubscription(id, req.user.companyId);
  }
}
