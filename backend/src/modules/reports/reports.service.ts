import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

export interface DateRange {
  from: Date;
  to: Date;
}

export interface RevenueReport {
  totalRevenue: number;
  totalCmv: number;
  grossProfit: number;
  grossMargin: number;
  orderCount: number;
  avgTicket: number;
  cancelledCount: number;
  byPaymentMethod: Record<string, number>;
  byType: { delivery: number; dineIn: number; pickup: number };
  dailySeries: {
    date: string;
    revenue: number;
    cmv: number;
    profit: number;
    orders: number;
  }[];
}

export interface ProductRanking {
  productId: string;
  productName: string;
  quantity: number;
  revenue: number;
  cmv: number;
  profit: number;
  margin: number;
}

export interface ExecutiveKpis {
  revenue: number;
  revenueGrowth: number;
  grossProfit: number;
  grossMargin: number;
  orderCount: number;
  orderGrowth: number;
  avgTicket: number;
  ticketGrowth: number;
  cmv: number;
  cmvRatio: number;
  cancelRate: number;
  topProducts: ProductRanking[];
  last30Days: { date: string; revenue: number; orders: number }[];
}

function toNum(d: Decimal | null | undefined): number {
  return d ? Number(d) : 0;
}

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getRevenue(
    companyId: string,
    range: DateRange,
  ): Promise<RevenueReport> {
    const orders = await this.prisma.order.findMany({
      where: {
        companyId,
        createdAt: { gte: range.from, lte: range.to },
        status: { not: 'CANCELLED' },
      },
      take: 5000,
      include: { items: true },
    });

    const cancelled = await this.prisma.order.count({
      where: {
        companyId,
        createdAt: { gte: range.from, lte: range.to },
        status: 'CANCELLED',
      },
    });

    let totalRevenue = 0,
      totalCmv = 0;
    const byPaymentMethod: Record<string, number> = {};
    const byType = { delivery: 0, dineIn: 0, pickup: 0 };
    const dailyMap: Record<
      string,
      { revenue: number; cmv: number; profit: number; orders: number }
    > = {};

    for (const order of orders) {
      const rev = toNum(order.total);
      const cmv = order.items.reduce((s, i) => s + toNum(i.cmv), 0);
      totalRevenue += rev;
      totalCmv += cmv;

      const pm = order.paymentMethod;
      byPaymentMethod[pm] = (byPaymentMethod[pm] || 0) + rev;

      const type = order.orderType as string | null;
      if (type === 'DELIVERY') byType.delivery += rev;
      else if (type === 'PICKUP') byType.pickup += rev;
      else byType.dineIn += rev;

      const day = order.createdAt.toISOString().slice(0, 10);
      if (!dailyMap[day])
        dailyMap[day] = { revenue: 0, cmv: 0, profit: 0, orders: 0 };
      dailyMap[day].revenue += rev;
      dailyMap[day].cmv += cmv;
      dailyMap[day].profit += rev - cmv;
      dailyMap[day].orders += 1;
    }

    const grossProfit = totalRevenue - totalCmv;
    const grossMargin = totalRevenue > 0 ? grossProfit / totalRevenue : 0;
    const orderCount = orders.length;
    const avgTicket = orderCount > 0 ? totalRevenue / orderCount : 0;

    const dailySeries = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v }));

    return {
      totalRevenue,
      totalCmv,
      grossProfit,
      grossMargin,
      orderCount,
      avgTicket,
      cancelledCount: cancelled,
      byPaymentMethod,
      byType,
      dailySeries,
    };
  }

  async getProductRanking(
    companyId: string,
    range: DateRange,
    limit = 10,
  ): Promise<ProductRanking[]> {
    const items = await this.prisma.orderItem.findMany({
      where: {
        companyId,
        createdAt: { gte: range.from, lte: range.to },
        order: { status: { not: 'CANCELLED' } },
      },
    });

    const map: Record<string, ProductRanking> = {};
    for (const item of items) {
      const key = item.productId;
      if (!map[key]) {
        map[key] = {
          productId: key,
          productName: item.productName,
          quantity: 0,
          revenue: 0,
          cmv: 0,
          profit: 0,
          margin: 0,
        };
      }
      const rev = toNum(item.subtotal);
      const cmv = toNum(item.cmv);
      map[key].quantity += Number(item.quantity);
      map[key].revenue += rev;
      map[key].cmv += cmv;
      map[key].profit += rev - cmv;
    }

    return Object.values(map)
      .map((r) => ({ ...r, margin: r.revenue > 0 ? r.profit / r.revenue : 0 }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  }

  async getExecutiveKpis(companyId: string): Promise<ExecutiveKpis> {
    const now = new Date();
    const start30 = new Date(now);
    start30.setDate(now.getDate() - 30);
    const start60 = new Date(now);
    start60.setDate(now.getDate() - 60);

    const [current, previous] = await Promise.all([
      this.getRevenue(companyId, { from: start30, to: now }),
      this.getRevenue(companyId, { from: start60, to: start30 }),
    ]);

    const growth = (cur: number, prev: number) =>
      prev > 0 ? (cur - prev) / prev : 0;

    const topProducts = await this.getProductRanking(companyId, {
      from: start30,
      to: now,
    });

    const last30Days = current.dailySeries.map((d) => ({
      date: d.date,
      revenue: d.revenue,
      orders: d.orders,
    }));

    return {
      revenue: current.totalRevenue,
      revenueGrowth: growth(current.totalRevenue, previous.totalRevenue),
      grossProfit: current.grossProfit,
      grossMargin: current.grossMargin,
      orderCount: current.orderCount,
      orderGrowth: growth(current.orderCount, previous.orderCount),
      avgTicket: current.avgTicket,
      ticketGrowth: growth(current.avgTicket, previous.avgTicket),
      cmv: current.totalCmv,
      cmvRatio:
        current.totalRevenue > 0 ? current.totalCmv / current.totalRevenue : 0,
      cancelRate:
        current.orderCount + current.cancelledCount > 0
          ? current.cancelledCount /
            (current.orderCount + current.cancelledCount)
          : 0,
      topProducts,
      last30Days,
    };
  }

  async materializeKpiSnapshot(companyId: string) {
    const now = new Date();
    const from = new Date(now);
    from.setDate(now.getDate() - 1);
    const r = await this.getRevenue(companyId, { from, to: now });

    const snapshotAt = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      now.getHours(),
      0,
      0,
      0,
    );

    await this.prisma.kpiSnapshot.upsert({
      where: { companyId_snapshotAt: { companyId, snapshotAt } },
      create: {
        companyId,
        snapshotAt,
        revenue: r.totalRevenue,
        cmv: r.totalCmv,
        grossProfit: r.grossProfit,
        grossMargin: r.grossMargin,
        orderCount: r.orderCount,
        avgTicket: r.avgTicket,
        cancelledCount: r.cancelledCount,
        deliveryCount: r.byType.delivery > 0 ? 1 : 0,
        dineInCount: r.byType.dineIn > 0 ? 1 : 0,
        pickupCount: r.byType.pickup > 0 ? 1 : 0,
        pixRevenue: r.byPaymentMethod['PIX'] ?? 0,
        cardRevenue:
          (r.byPaymentMethod['CREDIT_CARD'] ?? 0) +
          (r.byPaymentMethod['DEBIT_CARD'] ?? 0),
        cashRevenue: r.byPaymentMethod['CASH'] ?? 0,
      },
      update: {
        revenue: r.totalRevenue,
        cmv: r.totalCmv,
        grossProfit: r.grossProfit,
        grossMargin: r.grossMargin,
        orderCount: r.orderCount,
        avgTicket: r.avgTicket,
        cancelledCount: r.cancelledCount,
        pixRevenue: r.byPaymentMethod['PIX'] ?? 0,
        cardRevenue:
          (r.byPaymentMethod['CREDIT_CARD'] ?? 0) +
          (r.byPaymentMethod['DEBIT_CARD'] ?? 0),
        cashRevenue: r.byPaymentMethod['CASH'] ?? 0,
      },
    });
  }
}
