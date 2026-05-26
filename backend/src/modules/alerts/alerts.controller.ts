import { Controller, Get, Patch, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('alerts')
export class AlertsController {
  constructor(private alerts: AlertsService) {}

  @Get()
  findAll(@Req() req: any, @Query('unread') unread: string) {
    return this.alerts.findAll(req.user.companyId, unread === 'true');
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @Req() req: any) {
    return this.alerts.markRead(id, req.user.companyId);
  }

  @Patch('read-all')
  markAllRead(@Req() req: any) {
    return this.alerts.markAllRead(req.user.companyId);
  }
}
