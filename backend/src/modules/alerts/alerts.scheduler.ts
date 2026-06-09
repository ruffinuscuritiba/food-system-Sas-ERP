import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { ReportsService } from '../reports/reports.service';
import { AlertsService } from './alerts.service';

@Injectable()
export class AlertsScheduler {
  private readonly logger = new Logger(AlertsScheduler.name);
  private interval: NodeJS.Timeout;

  constructor(
    private prisma: PrismaService,
    private reports: ReportsService,
    private alerts: AlertsService,
  ) {
    // Run every hour — no startup run to protect heap during cold start
    this.interval = setInterval(() => this.run(), 60 * 60 * 1000);
  }

  async run() {
    this.logger.log('Running KPI snapshot + alert generation');
    const companies = await this.prisma.company.findMany({
      where: { isBlocked: false },
      select: { id: true },
    });

    for (let i = 0; i < companies.length; i++) {
      const { id: companyId } = companies[i];
      try {
        await this.reports.materializeKpiSnapshot(companyId);
        await this.generateAlerts(companyId);
      } catch (e) {
        this.logger.error(`Failed for company ${companyId}: ${e.message}`);
      }
      // Yield to event loop between companies — lets GC reclaim heap
      if (i < companies.length - 1)
        await new Promise((r) => setTimeout(r, 500));
    }
  }

  private async generateAlerts(companyId: string) {
    const now = new Date();
    const from7 = new Date(now);
    from7.setDate(now.getDate() - 7);
    const from14 = new Date(now);
    from14.setDate(now.getDate() - 14);

    const [current, previous] = await Promise.all([
      this.reports.getRevenue(companyId, { from: from7, to: now }),
      this.reports.getRevenue(companyId, { from: from14, to: from7 }),
    ]);

    // Revenue drop > 20%
    if (previous.totalRevenue > 0) {
      const drop =
        (previous.totalRevenue - current.totalRevenue) / previous.totalRevenue;
      if (drop > 0.2) {
        await this.alerts.createAlert({
          companyId,
          type: 'REVENUE_DROP',
          severity: drop > 0.4 ? 'CRITICAL' : 'WARNING',
          title: 'Queda de Faturamento',
          message: `Faturamento caiu ${(drop * 100).toFixed(1)}% em relação à semana anterior.`,
          metadata: {
            drop,
            current: current.totalRevenue,
            previous: previous.totalRevenue,
          },
        });
      }
    }

    // High CMV > 50%
    if (current.totalRevenue > 0 && current.grossMargin < 0.5) {
      await this.alerts.createAlert({
        companyId,
        type: 'HIGH_CMV',
        severity: current.grossMargin < 0.3 ? 'CRITICAL' : 'WARNING',
        title: 'CMV Elevado',
        message: `Margem bruta está em ${(current.grossMargin * 100).toFixed(1)}%. Revise os custos dos produtos.`,
        metadata: {
          margin: current.grossMargin,
          cmv: current.totalCmv,
          revenue: current.totalRevenue,
        },
      });
    }

    // Cancellation spike > 15%
    const total = current.orderCount + current.cancelledCount;
    if (total > 10) {
      const rate = current.cancelledCount / total;
      if (rate > 0.15) {
        await this.alerts.createAlert({
          companyId,
          type: 'CANCELLATION_SPIKE',
          severity: rate > 0.3 ? 'CRITICAL' : 'WARNING',
          title: 'Alta Taxa de Cancelamentos',
          message: `${(rate * 100).toFixed(1)}% dos pedidos foram cancelados nos últimos 7 dias.`,
          metadata: { rate, cancelled: current.cancelledCount, total },
        });
      }
    }

    // Low stock check
    const lowStock = await this.prisma.ingredient.findMany({
      where: { companyId, isActive: true, deletedAt: null },
      select: { id: true, name: true, stock: true, minimumStock: true },
    });
    for (const ing of lowStock) {
      if (
        Number(ing.stock) <= Number(ing.minimumStock) &&
        Number(ing.minimumStock) > 0
      ) {
        await this.alerts.createAlert({
          companyId,
          type: 'LOW_STOCK',
          severity: Number(ing.stock) <= 0 ? 'CRITICAL' : 'WARNING',
          title: 'Estoque Baixo',
          message: `${ing.name} está com estoque baixo: ${Number(ing.stock)} unidades (mínimo: ${Number(ing.minimumStock)}).`,
          metadata: {
            ingredientId: ing.id,
            stock: Number(ing.stock),
            minimum: Number(ing.minimumStock),
          },
        });
      }
    }
  }

  onModuleDestroy() {
    clearInterval(this.interval);
  }
}
