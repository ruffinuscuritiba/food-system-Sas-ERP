import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  getStartOfTodayBrazil,
  parseBrazilDateStart,
  parseBrazilDateEnd,
  parseBrazilFlexibleStart,
  parseBrazilFlexibleEnd,
  toBrazilDateKey,
} from '@/common/utils/timezone';

@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private reports: ReportsService) {}

  @Get('executive')
  executive(
    @Req() req: any,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    // Mesmo padrão de default de /revenue e /products — sem isso o Dashboard
    // do /bi sempre mostrava os últimos 30 dias fixos, ignorando completamente
    // o preset "Hoje"/"7 dias"/"Personalizado" selecionado na tela.
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
    return this.reports.getExecutiveKpis(req.user.companyId, range);
  }

  @Get('revenue')
  revenue(
    @Req() req: any,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    // Aceita "YYYY-MM-DD" (dia inteiro) OU "YYYY-MM-DDTHH:mm" (data+horário
    // específico, filtro "Personalizado" do relatório) — parseBrazilFlexible*
    // detecta o formato pelo tamanho da string.
    const range = {
      from: from
        ? parseBrazilFlexibleStart(from)
        : (() => {
            const d = getStartOfTodayBrazil();
            d.setDate(d.getDate() - 30);
            return d;
          })(),
      to: to ? parseBrazilFlexibleEnd(to) : parseBrazilDateEnd(toBrazilDateKey(new Date())),
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
