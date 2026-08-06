import { BadRequestException, Injectable } from '@nestjs/common';
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
      // status !== CANCELLED — sem esse filtro, pedido cancelado (que nunca
      // gerou faturamento real) inflava totalSales e ticketAverage do
      // dashboard financeiro.
      this.prisma.order.findMany({
        where: { companyId, status: { not: 'CANCELLED' } },
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
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Valor (amount) inválido — informe um número maior que zero.');
    }
    if (!data.type || !data.category) {
      throw new BadRequestException('Tipo (type) e categoria (category) são obrigatórios.');
    }
    return this.prisma.financial.create({
      data: { ...data, amount },
    });
  }
}
