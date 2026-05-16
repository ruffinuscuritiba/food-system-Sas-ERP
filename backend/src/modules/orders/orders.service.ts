import {
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import {
  OrderStatus,
  Prisma,
} from "@prisma/client";

import { PrismaService }
from "@/database/prisma.service";

import { StockService }
from "../stock/stock.service";

import { SocketGateway }
from "../../socket/socket.gateway";

@Injectable()
export class OrdersService {

  constructor(
    private prisma: PrismaService,

    private stockService: StockService,

    private socketGateway: SocketGateway,
  ) {}

  async create(data: any) {

    const productsIds =
      data.items.map(
        (item) => item.productId,
      );

    const products =
      await this.prisma.product.findMany({

        where: {

          id: {
            in: productsIds,
          },

          companyId:
            data.companyId,
        },
      });

    const productsMap =
      new Map(

        products.map(
          (product) => [

            product.id,

            product,
          ],
        ),
      );

    let subtotal = 0;

    const orderItemsData =
      data.items.map((item) => {

        const product =
          productsMap.get(
            item.productId,
          );

        if (!product) {

          throw new NotFoundException(
            "Produto não encontrado",
          );
        }

        const quantity =
          Number(item.quantity);

        const unitPrice =
          Number(
            product.salePrice || 0,
          );

        const itemSubtotal =
          quantity * unitPrice;

        subtotal +=
          itemSubtotal;

        return {

          productId:
            product.id,

          quantity,

          unitPrice,

          subtotal:
            itemSubtotal,

          notes:
            item.notes,

          companyId:
            data.companyId,

          productName:
            product.name,

          productSku:
            product.sku,

          productCost:
            product.costPrice,
        };
      });

    const deliveryFee =
      Number(
        data.deliveryFee || 0,
      );

    const total =
      subtotal + deliveryFee;

    const order =
      await this.prisma.$transaction(

        async (tx) => {

          return tx.order.create({

            data: {

              customerId:
                data.customerId,

              paymentMethod:
                data.paymentMethod,

              subtotal,

              deliveryFee,

              total,

              notes:
                data.notes,

              status:
                OrderStatus.PENDING,

              companyId:
                data.companyId,

              items: {

                create:
                  orderItemsData,
              },
            },

            include: {

              items: true,

              customer: true,
            },
          });
        },

        {
          isolationLevel:
            Prisma.TransactionIsolationLevel.Serializable,
        },
      );

    this.socketGateway
      .emitOrderCreated(order);

    const dashboard =
      await this.dashboard(
        data.companyId,
      );

    this.socketGateway
      .emitDashboardUpdate(
        dashboard,
      );

    return order;
  }

  findAll(
    companyId: string,
  ) {

    return this.prisma.order.findMany({

      where: {
        companyId,
      },

      orderBy: {
        createdAt: "desc",
      },

      include: {

        customer: true,

        items: true,
      },
    });
  }

  async updateStatus(
    id: string,
    status: OrderStatus,
    userId: string,
  ) {

    const order =
      await this.prisma.order.findFirst({

        where: {
          id,
        },

        include: {

          items: true,
        },
      });

    if (!order) {

      throw new NotFoundException(
        "Pedido não encontrado",
      );
    }

    const updatedOrder =
      await this.prisma.$transaction(

        async (tx) => {

          if (

            status ===
              OrderStatus.CONFIRMED &&

            order.status ===
              OrderStatus.PENDING
          ) {

            for (
              const orderItem
              of order.items
            ) {

              const recipe =
                await tx.recipe.findFirst({

                  where: {
                    productId:
                      orderItem.productId,
                  },

                  include: {

                    items: {

                      include: {
                        ingredient: true,
                      },
                    },
                  },
                });

              if (!recipe) {
                continue;
              }

              let itemCmv = 0;

              for (
                const recipeItem
                of recipe.items
              ) {

                const quantityToConsume =

                  Number(
                    recipeItem.quantity,
                  ) *

                  Number(
                    orderItem.quantity,
                  );

                const ingredientCost =

                  Number(
                    recipeItem.ingredient
                      .averageCost ||

                    recipeItem.ingredient
                      .cost,
                  );

                const totalIngredientCost =

                  ingredientCost *
                  quantityToConsume;

                itemCmv +=
                  totalIngredientCost;

                await this.stockService
                  .consumeIngredientTransactional(

                    tx,

                    {

                      ingredientId:
                        recipeItem.ingredientId,

                      quantity:
                        quantityToConsume,

                      companyId:
                        order.companyId,

                      performedById:
                        userId,

                      reason:

                        `Consumo automático pedido ${order.id}`,

                      referenceId:
                        order.id,

                      referenceType:
                        "ORDER",
                    },
                  );
              }

              const subtotal =
                Number(
                  orderItem.subtotal,
                );

              const profit =
                subtotal - itemCmv;

              await tx.orderItem.update({

                where: {
                  id: orderItem.id,
                },

                data: {

                  cmv:
                    itemCmv,

                  profit:
                    profit,
                },
              });
            }
          }

          if (

            status ===
              OrderStatus.CANCELLED &&

            order.status !==
              OrderStatus.CANCELLED
          ) {

            for (
              const orderItem
              of order.items
            ) {

              const recipe =
                await tx.recipe.findFirst({

                  where: {
                    productId:
                      orderItem.productId,
                  },

                  include: {

                    items: {

                      include: {
                        ingredient: true,
                      },
                    },
                  },
                });

              if (!recipe) {
                continue;
              }

              for (
                const recipeItem
                of recipe.items
              ) {

                const quantityToRestore =

                  Number(
                    recipeItem.quantity,
                  ) *

                  Number(
                    orderItem.quantity,
                  );

                await this.stockService
                  .restoreIngredientTransactional(

                    tx,

                    {

                      ingredientId:
                        recipeItem.ingredientId,

                      quantity:
                        quantityToRestore,

                      companyId:
                        order.companyId,

                      performedById:
                        userId,

                      reason:

                        `Rollback cancelamento pedido ${order.id}`,

                      referenceId:
                        order.id,

                      referenceType:
                        "ORDER",
                    },
                  );
              }
            }
          }

          const timestamps: any = {};

          if (
            status ===
            OrderStatus.CONFIRMED
          ) {

            timestamps.confirmedAt =
              new Date();
          }

          if (
            status ===
            OrderStatus.PREPARING
          ) {

            timestamps.preparingAt =
              new Date();
          }

          if (
            status ===
            OrderStatus.READY
          ) {

            timestamps.readyAt =
              new Date();
          }

          if (
            status ===
            OrderStatus.OUT_FOR_DELIVERY
          ) {

            timestamps.outForDeliveryAt =
              new Date();
          }

          if (
            status ===
            OrderStatus.DELIVERED
          ) {

            timestamps.deliveredAt =
              new Date();
          }

          if (
            status ===
            OrderStatus.CANCELLED
          ) {

            timestamps.cancelledAt =
              new Date();
          }

          return tx.order.update({

            where: {
              id: order.id,
            },

            data: {

              status,

              ...timestamps,
            },

            include: {

              items: true,

              customer: true,
            },
          });
        },

        {
          isolationLevel:
            Prisma.TransactionIsolationLevel.Serializable,
        },
      );

    this.socketGateway
      .emitKitchenUpdate(
        updatedOrder,
      );

    const dashboard =
      await this.dashboard(
        order.companyId,
      );

    this.socketGateway
      .emitDashboardUpdate(
        dashboard,
      );

    return updatedOrder;
  }

  async dashboard(
    companyId: string,
  ) {

    const orders =
      await this.prisma.order.findMany({

        where: {

          companyId,

          status: {

            not:
              OrderStatus.CANCELLED,
          },
        },

        include: {

          items: true,
        },
      });

    const revenue =
      orders.reduce(

        (
          total,
          order,
        ) => {

          return (
            total +
            Number(
              order.total,
            )
          );
        },

        0,
      );

    let totalProfit = 0;

    let totalCmv = 0;

    for (
      const order
      of orders
    ) {

      for (
        const item
        of order.items
      ) {

        totalProfit +=

          Number(
            item.profit || 0,
          );

        totalCmv +=

          Number(
            item.cmv || 0,
          );
      }
    }

    const totalOrders =
      orders.length;

    const averageTicket =
      totalOrders > 0

        ? revenue /
          totalOrders

        : 0;

    const margin =
      revenue > 0

        ? (
            totalProfit /
            revenue
          ) * 100

        : 0;

    return {

      revenue,

      totalProfit,

      totalCmv,

      margin,

      totalOrders,

      averageTicket,
    };
  }
}