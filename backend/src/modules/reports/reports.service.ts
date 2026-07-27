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

export interface CustomerStats {
  total: number;
  contacts: number;
  active: number;
  segments: { novos: number; recorrentes: number; fidelizados: number };
}

export interface FeedbackStats {
  totalRequested: number;
  totalResponded: number;
  responseRate: number;
  positive: number;
  negative: number;
  satisfactionRate: number;
  recent: {
    id: string;
    customerName: string | null;
    responseText: string | null;
    sentiment: string | null;
    respondedAt: string | null;
    createdAt: string;
  }[];
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

  // Une Order (PDV/mesa/WhatsApp) + OnlineOrder (cardápio digital/totem) —
  // relatórios que só olhavam Order subestimavam o faturamento real sempre
  // que a loja recebe pedido pelo link do cardápio (o canal mais comum).
  async getRevenue(
    companyId: string,
    range: DateRange,
  ): Promise<RevenueReport> {
    const [orders, onlineOrders] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          companyId,
          createdAt: { gte: range.from, lte: range.to },
          status: { not: 'CANCELLED' },
        },
        include: { items: true },
      }),
      this.prisma.onlineOrder.findMany({
        where: {
          companyId,
          createdAt: { gte: range.from, lte: range.to },
          orderStatus: { not: 'CANCELED' },
        },
      }),
    ]);

    const [cancelledOrders, cancelledOnline] = await Promise.all([
      this.prisma.order.count({
        where: {
          companyId,
          createdAt: { gte: range.from, lte: range.to },
          status: 'CANCELLED',
        },
      }),
      this.prisma.onlineOrder.count({
        where: {
          companyId,
          createdAt: { gte: range.from, lte: range.to },
          orderStatus: 'CANCELED',
        },
      }),
    ]);

    // CMV de OnlineOrder não é gravado por item (items é JSON, não OrderItem
    // relacional) — aproxima via Product.costPrice atual, mesma lógica usada
    // em outros lugares do painel que precisam de uma estimativa de CMV para
    // pedidos online.
    const onlineProductIds = new Set<string>();
    for (const o of onlineOrders) {
      const items = Array.isArray(o.items) ? (o.items as any[]) : [];
      for (const it of items) if (it?.productId) onlineProductIds.add(it.productId);
    }
    const costByProductId = new Map<string, number>();
    if (onlineProductIds.size > 0) {
      const products = await this.prisma.product.findMany({
        where: { id: { in: [...onlineProductIds] }, companyId },
        select: { id: true, costPrice: true },
      });
      products.forEach((p) => costByProductId.set(p.id, toNum(p.costPrice)));
    }

    let totalRevenue = 0,
      totalCmv = 0;
    const byPaymentMethod: Record<string, number> = {};
    const byType = { delivery: 0, dineIn: 0, pickup: 0 };
    const dailyMap: Record<
      string,
      { revenue: number; cmv: number; profit: number; orders: number }
    > = {};

    const bump = (
      rev: number,
      cmv: number,
      paymentMethod: string,
      orderType: string | null,
      createdAt: Date,
    ) => {
      totalRevenue += rev;
      totalCmv += cmv;

      byPaymentMethod[paymentMethod] =
        (byPaymentMethod[paymentMethod] || 0) + rev;

      if (orderType === 'DELIVERY') byType.delivery += rev;
      else if (orderType === 'PICKUP') byType.pickup += rev;
      else byType.dineIn += rev;

      const day = createdAt.toISOString().slice(0, 10);
      if (!dailyMap[day])
        dailyMap[day] = { revenue: 0, cmv: 0, profit: 0, orders: 0 };
      dailyMap[day].revenue += rev;
      dailyMap[day].cmv += cmv;
      dailyMap[day].profit += rev - cmv;
      dailyMap[day].orders += 1;
    };

    for (const order of orders) {
      const rev = toNum(order.total);
      const cmv = order.items.reduce((s, i) => s + toNum(i.cmv), 0);
      bump(rev, cmv, order.paymentMethod, order.orderType, order.createdAt);
    }

    for (const o of onlineOrders) {
      const rev = toNum(o.total);
      const items = Array.isArray(o.items) ? (o.items as any[]) : [];
      const cmv = items.reduce((s, it) => {
        const unitCost = costByProductId.get(it?.productId) ?? 0;
        return s + unitCost * Number(it?.quantity ?? 0);
      }, 0);
      bump(rev, cmv, o.paymentMethod, o.orderType, o.createdAt);
    }

    const grossProfit = totalRevenue - totalCmv;
    const grossMargin = totalRevenue > 0 ? grossProfit / totalRevenue : 0;
    const orderCount = orders.length + onlineOrders.length;
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
      cancelledCount: cancelledOrders + cancelledOnline,
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
    const [items, onlineOrders] = await Promise.all([
      this.prisma.orderItem.findMany({
        where: {
          companyId,
          createdAt: { gte: range.from, lte: range.to },
          order: { status: { not: 'CANCELLED' } },
        },
      }),
      this.prisma.onlineOrder.findMany({
        where: {
          companyId,
          createdAt: { gte: range.from, lte: range.to },
          orderStatus: { not: 'CANCELED' },
        },
        select: { items: true },
      }),
    ]);

    const onlineProductIds = new Set<string>();
    for (const o of onlineOrders) {
      const raw = Array.isArray(o.items) ? (o.items as any[]) : [];
      for (const it of raw) if (it?.productId) onlineProductIds.add(it.productId);
    }
    const costByProductId = new Map<string, number>();
    if (onlineProductIds.size > 0) {
      const products = await this.prisma.product.findMany({
        where: { id: { in: [...onlineProductIds] }, companyId },
        select: { id: true, costPrice: true },
      });
      products.forEach((p) => costByProductId.set(p.id, toNum(p.costPrice)));
    }

    const map: Record<string, ProductRanking> = {};
    const add = (
      productId: string,
      productName: string,
      quantity: number,
      revenue: number,
      cmv: number,
    ) => {
      if (!map[productId]) {
        map[productId] = {
          productId,
          productName,
          quantity: 0,
          revenue: 0,
          cmv: 0,
          profit: 0,
          margin: 0,
        };
      }
      map[productId].quantity += quantity;
      map[productId].revenue += revenue;
      map[productId].cmv += cmv;
      map[productId].profit += revenue - cmv;
    };

    for (const item of items) {
      add(
        item.productId,
        item.productName,
        Number(item.quantity),
        toNum(item.subtotal),
        toNum(item.cmv),
      );
    }

    for (const o of onlineOrders) {
      const raw = Array.isArray(o.items) ? (o.items as any[]) : [];
      for (const it of raw) {
        if (!it?.productId) continue;
        const quantity = Number(it.quantity ?? 0);
        const revenue = Number(it.unitPrice ?? 0) * quantity;
        const cmv = (costByProductId.get(it.productId) ?? 0) * quantity;
        add(it.productId, it.productName ?? 'Produto', quantity, revenue, cmv);
      }
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

  // Segmentação de clientes (aba Clientes). Order.customerId praticamente
  // nunca é preenchido na prática (PDV/mesa/WhatsApp salvam customerPhone
  // como texto solto, sem popular a FK) — contar por Customer.orders (relação)
  // subestimava TUDO pra "nunca pediu". Conta de verdade por telefone
  // normalizado (últimos 8 dígitos, ignora DDI/DDD/hífen/formatação), cruzando
  // Customer.phone com Order.customerPhone e OnlineOrder.customerPhone.
  async getCustomerStats(companyId: string): Promise<CustomerStats> {
    const normalize = (phone: string | null | undefined): string | null => {
      if (!phone) return null;
      const digits = phone.replace(/\D/g, '');
      return digits.length >= 8 ? digits.slice(-8) : null;
    };

    const [customers, orders, onlineOrders] = await Promise.all([
      this.prisma.customer.findMany({
        where: { companyId },
        select: { id: true, phone: true },
      }),
      this.prisma.order.findMany({
        where: { companyId, customerPhone: { not: null } },
        select: { customerPhone: true },
      }),
      this.prisma.onlineOrder.findMany({
        where: { companyId },
        select: { customerPhone: true },
      }),
    ]);

    const orderCountByPhone = new Map<string, number>();
    for (const o of [...orders, ...onlineOrders]) {
      const key = normalize(o.customerPhone);
      if (!key) continue;
      orderCountByPhone.set(key, (orderCountByPhone.get(key) ?? 0) + 1);
    }

    const total = customers.length;
    let contacts = 0,
      active = 0,
      novos = 0,
      recorrentes = 0,
      fidelizados = 0;

    for (const c of customers) {
      const key = normalize(c.phone);
      const count = key ? orderCountByPhone.get(key) ?? 0 : 0;
      if (count === 0) {
        contacts++;
        continue;
      }
      active++;
      if (count === 1) novos++;
      else if (count <= 4) recorrentes++;
      else fidelizados++;
    }

    return {
      total,
      contacts,
      active,
      segments: { novos, recorrentes, fidelizados },
    };
  }

  // Qualidade (aba Qualidade) — a plataforma não coleta nota 1-5, só
  // sentimento (POSITIVE/NEGATIVE) via classificação por palavra-chave da
  // resposta do cliente ao pedido de feedback pós-entrega (WhatsApp). Por
  // isso "satisfactionRate" é % de respostas positivas, não uma média de
  // estrelas — evita fabricar uma nota que o sistema não mede de verdade.
  async getFeedbackStats(companyId: string): Promise<FeedbackStats> {
    const [totalRequested, responded, positive, negative, recent] =
      await Promise.all([
        this.prisma.deliveryFeedback.count({ where: { companyId } }),
        this.prisma.deliveryFeedback.count({
          where: { companyId, respondedAt: { not: null } },
        }),
        this.prisma.deliveryFeedback.count({
          where: { companyId, sentiment: 'POSITIVE' },
        }),
        this.prisma.deliveryFeedback.count({
          where: { companyId, sentiment: 'NEGATIVE' },
        }),
        this.prisma.deliveryFeedback.findMany({
          where: { companyId, respondedAt: { not: null } },
          orderBy: { respondedAt: 'desc' },
          take: 20,
          select: {
            id: true,
            customerName: true,
            responseText: true,
            sentiment: true,
            respondedAt: true,
            createdAt: true,
          },
        }),
      ]);

    const sentimentTotal = positive + negative;

    return {
      totalRequested,
      totalResponded: responded,
      responseRate: totalRequested > 0 ? responded / totalRequested : 0,
      positive,
      negative,
      satisfactionRate: sentimentTotal > 0 ? positive / sentimentTotal : 0,
      recent: recent.map((r) => ({
        ...r,
        respondedAt: r.respondedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }
}
