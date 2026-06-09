import { Injectable } from '@nestjs/common';
import { FinancialType } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';

@Injectable()
export class FinancialService {
  constructor(private prisma: PrismaService) {}

  findAll(companyId: string) {
    return this.prisma.financial.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async summary(companyId: string) {
    const [entries, exits, orders] = await Promise.all([
      this.prisma.financial.aggregate({
        _sum: { amount: true },
        where: { companyId, type: FinancialType.INCOME },
      }),
      this.prisma.financial.aggregate({
        _sum: { amount: true },
        where: { companyId, type: FinancialType.EXPENSE },
      }),
      this.prisma.order.findMany({
        where: { companyId },
        select: { total: true },
      }),
    ]);

    const totalSales = orders.reduce((acc, o) => acc + Number(o.total), 0);
    const ticketAverage = orders.length > 0 ? totalSales / orders.length : 0;

    return {
      entries: Number(entries._sum.amount || 0),
      exits: Number(exits._sum.amount || 0),
      balance:
        Number(entries._sum.amount || 0) - Number(exits._sum.amount || 0),
      totalSales,
      totalOrders: orders.length,
      ticketAverage: Number(ticketAverage.toFixed(2)),
    };
  }

  create(data: any) {
    return this.prisma.financial.create({
      data: { ...data, amount: Number(data.amount) },
    });
  }
}
