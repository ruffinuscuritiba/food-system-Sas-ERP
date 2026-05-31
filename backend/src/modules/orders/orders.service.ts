import {
  Injectable,
  NotFoundException,
  Optional,
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

import { LoyaltyService }
from "../loyalty/loyalty.service";

import { WhatsappAiService }
from "../whatsapp-ai/whatsapp-ai.service";

@Injectable()
export class OrdersService {

  constructor(
    private prisma: PrismaService,

    private stockService: StockService,

    private socketGateway: SocketGateway,

    private loyaltyService: LoyaltyService,

    @Optional()
    private whatsappAiService?: WhatsappAiService,
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

        // ✅ CORREÇÃO — usa o unitPrice enviado pelo frontend (snapshot do carrinho).
        // Fallback para product.salePrice caso o frontend não envie o campo.
        const unitPrice =
          Number(item.unitPrice ?? product.salePrice ?? 0);

        // Include complement prices in item subtotal
        const complementsExtra =
          Array.isArray(item.complements)
            ? item.complements.reduce(
                (s: number, c: any) =>
                  s + Number(c.price ?? 0) * Number(c.quantity ?? 1),
                0,
              )
            : 0;

        const itemSubtotal =
          quantity * unitPrice +
          complementsExtra * quantity;

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

          // 1. Create the Order without nested items — no index-ordering dependency
          const createdOrder =
            await tx.order.create({

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

                // Fase 2: tipo de atendimento e dados do cliente
                orderType:
                  data.orderType || 'DINE_IN',

                customerName:
                  data.customerName || null,

                customerPhone:
                  data.customerPhone || null,

                deliveryAddress:
                  data.deliveryAddress || null,
              },

              include: {
                customer: true,
              },
            });

          // 2. Create each OrderItem individually so its id is known before
          //    creating complements — eliminates createdOrder.items[i] dependency.
          //    orderItemsData[i] and data.items[i] share the same index by
          //    construction (both derived from the same data.items.map call).
          const createdItems: any[] = [];

          for (
            let i = 0;
            i < orderItemsData.length;
            i++
          ) {

            const createdItem =
              await tx.orderItem.create({

                data: {
                  ...orderItemsData[i],
                  orderId: createdOrder.id,
                },
              });

            createdItems.push(createdItem);

            // 3. Create complements for THIS specific item immediately —
            //    createdItem.id is deterministic, no array ordering involved.
            const comps: any[] =
              Array.isArray(data.items[i].complements)
                ? data.items[i].complements
                : [];

            for (const comp of comps) {

              await (tx as any).orderItemComplement.create({

                data: {

                  orderItemId:
                    createdItem.id,

                  complementOptionId:
                    comp.complementOptionId,

                  complementName:
                    comp.complementName,

                  optionName:
                    comp.optionName,

                  price:
                    Number(comp.price ?? 0),

                  quantity:
                    Number(comp.quantity ?? 1),
                },
              });
            }
          }

          // 4. Return the order with the same shape expected by callers
          return {
            ...createdOrder,
            items: createdItems,
          };
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
        data.companyId,
        dashboard,
      );

    return order;
  }

  findAll(
    companyId: string,
  ) {

    return (this.prisma as any).order.findMany({

      where: {
        companyId,
      },

      orderBy: {
        createdAt: "desc",
      },

      include: {

        customer: true,

        items: {

          include: {
            selectedComplements: true,
          },
        },
      },
    });
  }

  async updateStatus(
    id: string,
    status: OrderStatus,
    userId: string,
    companyId: string,
  ) {

    const order =
      await this.prisma.order.findFirst({

        where: {
          id,
          companyId,
        },

        include: {

          items: true,
          customer: true,
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

            // Hook de fidelidade após confirmação
            if (order.customerId) {
              await this.loyaltyService.processOrderReward(
                order.customerId,
                order.companyId,
                order.id,
                Number(order.total),
              );
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

            timestamps.completedAt =
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
              id,
            },

            data: {
              status,

              ...timestamps,
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

    // Cliente público escutando /pedido/confirmado?orderId=X recebe atualização
    this.socketGateway.emitOrderStatusChanged(id, {
      status: updatedOrder.status,
      source: 'PDV',
    });

    const dashboard =
      await this.dashboard(
        order.companyId,
      );

    this.socketGateway
      .emitDashboardUpdate(
        order.companyId,
        dashboard,
      );

    // WhatsApp customer notification (non-blocking, best-effort)
    const customerPhone = (order as any).customerPhone ?? order.customer?.phone;
    if (
      this.whatsappAiService &&
      customerPhone &&
      [
        'CONFIRMED',
        'READY',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
        'CANCELLED',
      ].includes(status)
    ) {
      setImmediate(async () => {
        try {
          await this.whatsappAiService!.sendOrderNotification({
            companyId: order.companyId,
            customerPhone: customerPhone,
            customerName: order.customer?.name ?? undefined,
            orderId: order.id,
            orderType: (order as any).orderType ?? 'DINE_IN',
            total: Number(order.total),
            items: order.items.map((i) => ({
              name: (i as any).productName ?? 'Item',
              quantity: Number(i.quantity),
            })),
            status: status as any,
          });
        } catch { /* silent */ }
      });
    }

    return updatedOrder;
  }

  async dashboard(
    companyId: string,
  ) {

    const today = new Date();

    today.setHours(0, 0, 0, 0);

    const orders =
      await this.prisma.order.findMany({

        where: {
          companyId,

          createdAt: {
            gte: today,
          },
        },
      });

    const totalOrders =
      orders.length;

    const totalRevenue =
      orders.reduce(
        (acc, order) =>
          acc +
          Number(order.total),
        0,
      );

    const pendingOrders =
      orders.filter(
        (order) =>
          order.status ===
          OrderStatus.PENDING,
      ).length;

    const confirmedOrders =
      orders.filter(
        (order) =>
          order.status ===
          OrderStatus.CONFIRMED,
      ).length;

    return {
      totalOrders,

      totalRevenue,

      pendingOrders,

      confirmedOrders,
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ADAPTER COZINHA/PEDIDOS — Caminho 2 do Item 4
  // Unifica Order (PDV) + OnlineOrder (Cardápio Digital) em shape único.
  // Não altera Order/OnlineOrder. Sem mexer em pagamento/webhook.
  // ════════════════════════════════════════════════════════════════════════════

  /** Status operacional unificado — único enum que o frontend conhece. */
  static readonly KITCHEN_STATUSES = [
    'PENDING',
    'CONFIRMED',
    'PREPARING',
    'READY',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'CANCELLED',
  ] as const;

  /** OnlineOrderStatus → status operacional unificado. */
  private mapOnlineStatusToKitchen(s: string): string {
    switch (s) {
      case 'DELIVERING': return 'OUT_FOR_DELIVERY';
      case 'COMPLETED':  return 'DELIVERED';
      case 'CANCELED':   return 'CANCELLED';
      default:           return s; // PENDING, CONFIRMED, PREPARING, READY mantêm
    }
  }

  /** Status operacional unificado → OnlineOrderStatus. */
  private mapKitchenStatusToOnline(s: string): string {
    switch (s) {
      case 'OUT_FOR_DELIVERY': return 'DELIVERING';
      case 'DELIVERED':        return 'COMPLETED';
      case 'CANCELLED':        return 'CANCELED';
      default:                 return s;
    }
  }

  /** Lista unificada Order + OnlineOrder com shape único. */
  async findAllForKitchen(companyId: string) {
    const [pdvOrders, onlineOrdersRaw] = await Promise.all([
      (this.prisma as any).order.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        include: {
          customer: true,
          items: { include: { selectedComplements: true } },
        },
      }),
      (this.prisma as any).onlineOrder.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // ── Normaliza PDV ───────────────────────────────────────────────────
    const pdv = pdvOrders.map((o: any) => ({
      id:                o.id,
      source:            'PDV' as const,
      status:            o.status,            // já no enum unificado
      productionStatus:  o.productionStatus ?? null,
      createdAt:         o.createdAt,
      customerName:      o.customer?.name ?? o.customerName ?? null,
      customerPhone:     o.customer?.phone ?? null,
      customerAddress:   o.customer?.address ?? null,
      orderType:         (o as any).orderType ?? 'DINE_IN',
      total:             Number(o.total),
      paymentMethod:     o.paymentMethod ?? null,
      notes:             o.notes ?? null,
      items: (o.items ?? []).map((it: any) => ({
        productName:   it.productName,
        quantity:      it.quantity,
        notes:         it.notes ?? '',
        unitPrice:     Number(it.unitPrice ?? 0),
        subtotal:      Number(it.subtotal ?? 0),
        selectedComplements: (it.selectedComplements ?? []).map((c: any) => ({
          complementName: c.complementName,
          optionName:     c.optionName,
          price:          Number(c.price),
          quantity:       c.quantity,
        })),
      })),
    }));

    // ── Normaliza OnlineOrder ───────────────────────────────────────────
    const online = onlineOrdersRaw.map((o: any) => {
      const rawItems: any[] = Array.isArray(o.items) ? o.items : [];
      return {
        id:                o.id,
        source:            'ONLINE' as const,
        // OnlineOrder usa `orderStatus`; PDV usa `status`. Normalizamos para `status`.
        status:            this.mapOnlineStatusToKitchen(o.orderStatus),
        productionStatus:  null,
        createdAt:         o.createdAt,
        customerName:      o.customerName ?? null,
        customerPhone:     o.customerPhone ?? null,
        customerAddress:   [o.address, o.addressNumber, o.neighborhood, o.city]
                              .filter(Boolean).join(', ') || null,
        orderType:         o.orderType ?? 'DELIVERY',
        total:             Number(o.total),
        paymentMethod:     o.paymentMethod ?? null,
        notes:             o.notes ?? null,
        items: rawItems.map((it: any) => ({
          productName: it.productName,
          quantity:    Number(it.quantity ?? 1),
          notes:       it.notes ?? '',
          unitPrice:   Number(it.unitPrice ?? 0),
          subtotal:    Number(it.unitPrice ?? 0) * Number(it.quantity ?? 1),
          // Online: complementos vêm dentro do item.complements (Json) — Fase A1
          selectedComplements: Array.isArray(it.complements) ? it.complements.map((c: any) => ({
            complementName: c.complementName,
            optionName:     c.optionName,
            price:          Number(c.price ?? 0),
            quantity:       Number(c.quantity ?? 1),
          })) : [],
        })),
      };
    });

    // Merge e reordena por createdAt desc
    return [...pdv, ...online].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  /** Atualiza status operacional roteando para a tabela correta — multiempresa preservado. */
  async updateKitchenStatus(
    source: string,
    id: string,
    status: string,
    userId: string,
    companyId: string,
  ) {
    const allowed = OrdersService.KITCHEN_STATUSES as readonly string[];
    if (!allowed.includes(status)) {
      throw new NotFoundException(`Status "${status}" inválido.`);
    }

    if (source === 'PDV') {
      // Reusa fluxo existente (com transação Serializable, estoque, fidelidade)
      return this.updateStatus(id, status as OrderStatus, userId, companyId);
    }

    if (source === 'ONLINE') {
      const mapped = this.mapKitchenStatusToOnline(status);
      const onlineOrder = await (this.prisma as any).onlineOrder.findFirst({
        where: { id, companyId },
        select: { id: true },
      });
      if (!onlineOrder) throw new NotFoundException('Pedido online não encontrado.');

      const updated = await (this.prisma as any).onlineOrder.update({
        where: { id },
        data:  { orderStatus: mapped },
      });

      // Mantém cozinha em tempo real (mesmo socket dos PDVs)
      try {
        this.socketGateway.emitKitchenUpdate({ companyId, id, status, source: 'ONLINE' } as any);
        this.socketGateway.emitDashboardUpdate(companyId, {});
        // Cliente público acompanhando /pedido/confirmado?orderId=X recebe agora
        this.socketGateway.emitOrderStatusChanged(id, { status, source: 'ONLINE' });
      } catch { /* socket failure must not block */ }

      return { id: updated.id, source: 'ONLINE', status };
    }

    throw new NotFoundException(`Source "${source}" inválida.`);
  }
}