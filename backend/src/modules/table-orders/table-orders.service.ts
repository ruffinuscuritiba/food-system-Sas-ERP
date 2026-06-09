import { Injectable } from '@nestjs/common';

import { OrderStatus } from '@prisma/client';

import { PrismaService } from 'src/database/prisma.service';

@Injectable()
export class TableOrdersService {
  constructor(private prisma: PrismaService) {}

  create(data: any) {
    return this.prisma.tableOrder.create({
      data: {
        table: {
          connect: {
            id: data.tableId,
          },
        },

        company: {
          connect: {
            id: data.companyId,
          },
        },

        total: Number(data.total),

        status: OrderStatus.PENDING,

        items: {
          create: data.items.map((item: any) => ({
            product: {
              connect: {
                id: item.productId,
              },
            },

            quantity: Number(item.quantity),

            price: Number(item.price),

            total: Number(item.total),
          })),
        },
      },

      include: {
        table: true,

        items: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  findAll() {
    return this.prisma.tableOrder.findMany({
      include: {
        table: true,

        items: {
          include: {
            product: true,
          },
        },
      },

      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  close(id: string) {
    return this.prisma.tableOrder.update({
      where: {
        id,
      },

      data: {
        status: OrderStatus.DELIVERED,
      },
    });
  }
}
