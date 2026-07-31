import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  getStartOfTodayBrazil,
  parseBrazilDateStart,
  parseBrazilDateEnd,
  toBrazilDateKey,
} from '@/common/utils/timezone';

@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private reports: ReportsService) {}

  @Get('executive')
  executive(@Req() req: any) {
    return this.reports.getExecutiveKpis(req.user.companyId);
  }

  @Get('revenue')
  revenue(
    @Req() req: any,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const range = {
      from: from
        ? parseBrazilDateStart(from)
        : (() => {
            const d = getStartOfTodayBrazil();
            d.setDate(d.getDate() - 30);
            return d;
          })(),
      to: to ? parseBrazilDateEnd(to) : parseBrazilDateEnd(toBrazilDateKey(new Date())),
    };
    return this.reports.getRevenue(req.user.companyId, range);
  }

  @Get('customers')
  customers(@Req() req: any) {
    return this.reports.getCustomerStats(req.user.companyId);
  }

  @Get('feedback')
  feedback(@Req() req: any) {
    return this.reports.getFeedbackStats(req.user.companyId);
  }

  @Get('products')
  products(
    @Req() req: any,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('limit') limit: string,
  ) {
    const range = {
      from: from
        ? parseBrazilDateStart(from)
        : (() => {
            const d = getStartOfTodayBrazil();
            d.setDate(d.getDate() - 30);
            return d;
          })(),
      to: to ? parseBrazilDateEnd(to) : parseBrazilDateEnd(toBrazilDateKey(new Date())),
    };
    return this.reports.getProductRanking(
      req.user.companyId,
      range,
      limit ? Number(limit) : 10,
    );
  }
}
