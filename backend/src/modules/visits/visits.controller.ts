import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { VisitsService } from './visits.service';
import { SuperAdminGuard } from '@/modules/super-admin/super-admin.guard';

@Controller('visits')
export class VisitsController {
  constructor(private service: VisitsService) {}

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  track(@Body('page') page: string) {
    return this.service.track(page || '/demo');
  }

  @Get('stats')
  @UseGuards(SuperAdminGuard)
  stats(@Query('page') page: string) {
    return this.service.getStats(page || '/demo');
  }
}
