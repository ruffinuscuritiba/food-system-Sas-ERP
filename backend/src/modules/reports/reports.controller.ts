import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

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
        ? new Date(from)
        : (() => {
            const d = new Date();
            d.setDate(d.getDate() - 30);
            return d;
          })(),
      to: to ? new Date(to) : new Date(),
    };
    return this.reports.getRevenue(req.user.companyId, range);
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
        ? new Date(from)
        : (() => {
            const d = new Date();
            d.setDate(d.getDate() - 30);
            return d;
          })(),
      to: to ? new Date(to) : new Date(),
    };
    return this.reports.getProductRanking(
      req.user.companyId,
      range,
      limit ? Number(limit) : 10,
    );
  }
}
