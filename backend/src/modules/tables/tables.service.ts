import { Injectable } from '@nestjs/common';

import {
  TableStatus,
  OrderStatus,
} from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

import { SocketGateway } from '../../socket/socket.gateway';

@Injectable()
export class TablesService {

  constructor(
    private prisma: PrismaService,

    private socketGateway: SocketGateway,
  ) {}

  async findAll(
    companyId: string,
  ) {

    return this.prisma.table.findMany({

      where: {
        companyId,
      },

      orderBy: {
        number: 'asc',
      },
    });
  }

  async create(data: any) {

    return this.prisma.table.create({

      data: {

        number:
          Number(data.number),

        status:
          TableStatus.FREE,

        company: {
          connect: {
            id: data.companyId,
          },
        },
      },
    });
  }

  async updateStatus(
    id: string,
    status: string,
    companyId: string,
  ) {

    const table =
      await this.prisma.table.update({

        where: {
          id,
          companyId,
        },

        data: {
          status:
            status as TableStatus,
        },
      });

    this.socketGateway.emitTableUpdate(
      table.companyId,
      table,
    );

    return table;
  }

  async saveOrder(
    tableId: string,
    body: any,
  ) {

    const order =
      await this.prisma.tableOrder.create({

        data: {

          table: {
            connect: {
              id: tableId,
            },
          },

          company: {
            connect: {
              id: body.companyId,
            },
          },

          total:
            Number(body.total),

          status:
            OrderStatus.PENDING,

          items: {

            create:
              body.items.map(
                (item: any) => ({

                  product: {
                    connect: {
                      id: item.productId,
                    },
                  },

                  quantity:
                    Number(item.quantity),

                  price:
                    Number(item.price),

                  total:
                    Number(item.total),
                }),
              ),
          },
        },
      });

    await this.prisma.table.update({

      where: {
        id: tableId,
        companyId: body.companyId,
      },

      data: {
        status:
          TableStatus.OCCUPIED,
      },
    });

    return order;
  }

  async findOrders(companyId: string) {

    return this.prisma.tableOrder.findMany({

      where: {
        companyId,
      },

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

  async dashboard(companyId: string) {

    const totalTables =
      await this.prisma.table.count({
        where: { companyId },
      });

    const occupiedTables =
      await this.prisma.table.count({

        where: {
          companyId,
          status:
            TableStatus.OCCUPIED,
        },
      });

    const freeTables =
      await this.prisma.table.count({

        where: {
          companyId,
          status:
            TableStatus.FREE,
        },
      });

    const orders =
      await this.prisma.tableOrder.findMany({
        where: { companyId },
      });

    let revenue = 0;

    for (const order of orders) {

      revenue +=
        Number(order.total);
    }

    return {

      totalTables,

      occupiedTables,

      freeTables,

      totalOrders:
        orders.length,

      revenue,
    };
  }
}