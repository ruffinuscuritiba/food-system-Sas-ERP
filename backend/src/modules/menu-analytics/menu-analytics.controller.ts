import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { MenuAnalyticsService } from './menu-analytics.service';

@Controller('menu-analytics')
export class MenuAnalyticsController {
  constructor(private readonly service: MenuAnalyticsService) {}

  // Público — chamado pelo cardápio digital a cada visualização de página/produto.
  @Post('track')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  track(
    @Body('companyId') companyId: string,
    @Body('type') type: string,
    @Body('productId') productId?: string,
  ) {
    return this.service.track(companyId, type, productId);
  }

  @Get('summary')
  @UseGuards(JwtAuthGuard)
  summary(
    @Request() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const range = {
      from: from
        ? new Date(from)
        : (() => {
            const d = new Date();
            d.setDate(d.getDate() - 30);
            return d;
          })(),
      to: to ? new Date(to) : new Date(),
    };
    return this.service.getSummary(req.user.companyId, range.from, range.to);
  }
}
