import { Injectable } from '@nestjs/common';

import {
  FinancialType,
} from '@prisma/client';

import { PrismaService } from 'src/database/prisma.service';

@Injectable()
export class FinancialService {

  constructor(
    private prisma: PrismaService,
  ) {}

  findAll() {

    return this.prisma.financial.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async summary() {

    const entries =
      await this.prisma.financial.aggregate({
        _sum: {
          amount: true,
        },

        where: {
          type: FinancialType.INCOME,
        },
      });

    const exits =
      await this.prisma.financial.aggregate({
        _sum: {
          amount: true,
        },

        where: {
          type: FinancialType.EXPENSE,
        },
      });

    const orders =
      await this.prisma.order.findMany();

    const totalSales =
      orders.reduce(
        (acc, order) =>
          acc + Number(order.total),
        0,
      );

    const ticketAverage =
      orders.length > 0
        ? totalSales / orders.length
        : 0;

    return {

      entries:
        Number(entries._sum.amount || 0),

      exits:
        Number(exits._sum.amount || 0),

      balance:
        Number(entries._sum.amount || 0) -
        Number(exits._sum.amount || 0),

      totalSales,

      totalOrders:
        orders.length,

      ticketAverage:
        Number(
          ticketAverage.toFixed(2),
        ),
    };
  }

  create(data: any) {

    return this.prisma.financial.create({
      data: {
        ...data,

        amount:
          Number(data.amount),
      },
    });
  }
}