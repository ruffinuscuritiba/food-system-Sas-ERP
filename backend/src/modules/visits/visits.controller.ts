import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { VisitsService } from './visits.service';
import { SuperAdminGuard } from '@/modules/super-admin/super-admin.guard';

@Controller('visits')
export class VisitsController {
  constructor(private service: VisitsService) {}

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  track(
    @Body('page') page: string,
    @Body('eventType') eventType?: string,
    @Body('label') label?: string,
  ) {
    return this.service.track(page || '/demo', eventType || 'VIEW', label);
  }

  @Get('stats')
  @UseGuards(SuperAdminGuard)
  stats(@Query('page') page: string) {
    return this.service.getStats(page || '/demo');
  }

  @Get('top-clicks')
  @UseGuards(SuperAdminGuard)
  topClicks(@Query('limit') limit?: string) {
    return this.service.getTopClicks(limit ? Number(limit) : 15);
  }
}
