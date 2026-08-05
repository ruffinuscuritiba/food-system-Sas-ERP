import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  Logger,
} from '@nestjs/common';
import { QrCampaignsService } from '@/modules/qr-campaigns/qr-campaigns.service';
import { LoyaltyMilestonesService } from '@/modules/loyalty-milestones/loyalty-milestones.service';

import { OrderStatus, Prisma } from '@prisma/client';

import { PrismaService } from '@/database/prisma.service';

import { StockService } from '../stock/stock.service';

import { SocketGateway } from '../../socket/socket.gateway';

import { LoyaltyService } from '../loyalty/loyalty.service';

import { WhatsappAiService } from '../whatsapp-ai/whatsapp-ai.service';

import { OrderNotificationService } from '../whatsapp-ai/services/order-notification.service';

import { DeliveryConfigService } from '../delivery-config/delivery-config.service';

import { PrintersService } from '../printers/printers.service';
import { PrintersGateway } from '../printers/printers.gateway';
import { OnlineOrdersService } from '../online-orders/online-orders.service';
import { ReportsService } from '../reports/reports.service';
import { getStartOfTodayBrazil, toBrazilDateKey } from '@/common/utils/timezone';

// Números BR ganharam o 9º dígito móvel em 2016 — clientes/atendentes ainda
// digitam sem ele por hábito ("67 9688-3803" em vez de "67 9 9688-3803").
// `phone.contains` nunca casa nesse caso (não é substring), então geramos
// as variantes com/sem o 9 pra tentar todas.
function buildPhoneCandidates(rawDigits: string): string[] {
  const candidates = new Set([rawDigits]);
  if (rawDigits.length === 10) {
    candidates.add(rawDigits.slice(0, 2) + '9' + rawDigits.slice(2));
  } else if (rawDigits.length === 12 && rawDigits.startsWith('55')) {
    candidates.add(rawDigits.slice(0, 4) + '9' + rawDigits.slice(4));
  } else if (rawDigits.length === 11) {
    candidates.add(rawDigits.slice(0, 2) + rawDigits.slice(3));
  } else if (rawDigits.length === 13 && rawDigits.startsWith('55')) {
    candidates.add(rawDigits.slice(0, 4) + rawDigits.slice(5));
  }
  return [...candidates];
}

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

/**
 * Preenche os 7 dias entre `weekAgo` e hoje com o valor real de vendas
 * (0 pro dia que não teve nenhum pedido) — `dailySeries` do ReportsService
 * só tem entrada pros dias que tiveram pedido, então sem esse fill o
 * gráfico "Fluxo de Caixa" pularia dias vazios em vez de mostrar R$ 0.
 */
function buildWeekSeries(
  weekAgo: Date,
  dailySeries: { date: string; revenue: number }[],
): { name: string; vendas: number }[] {
  const byDate = new Map(dailySeries.map((d) => [d.date, d.revenue]));
  const days: { name: string; vendas: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekAgo);
    d.setDate(d.getDate() + i);
    const key = toBrazilDateKey(d);
    days.push({ name: WEEKDAY_LABELS[d.getDay()], vendas: byDate.get(key) ?? 0 });
  }
  return days;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,

    private stockService: StockService,

    private socketGateway: SocketGateway,

    private loyaltyService: LoyaltyService,

    @Optional()
    private whatsappAiService?: WhatsappAiService,

    @Optional()
    private orderNotificationService?: OrderNotificationService,

    @Optional()
    private deliveryConfigService?: DeliveryConfigService,

    @Optional()
    private qrCampaigns?: QrCampaignsService,

    @Optional()
    private printersService?: PrintersService,

    @Optional()
    private printersGateway?: PrintersGateway,

    @Optional()
    private onlineOrdersService?: OnlineOrdersService,

    @Optional()
    private loyaltyMilestones?: LoyaltyMilestonesService,

    @Optional()
    private reportsService?: ReportsService,
  ) {}

  async create(data: any) {
    // Auditoria: sessão de caixa aberta no momento (se houver). Consultado
    // uma única vez e reaproveitado abaixo pra (a) travar venda em DINHEIRO
    // de balcão sem caixa aberto e (b) vincular o pedido via cashId.
    const openCash = await this.prisma.cash.findFirst({
      where: { companyId: data.companyId, isOpen: true },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    // Trava escopada: SÓ bloqueia venda de balcão/PDV paga em DINHEIRO físico
    // sem caixa aberto. NUNCA bloqueia iFood/Rappi/integrações (channel
    // explícito, ex: "IFOOD") nem outros métodos de pagamento (PIX, cartão) —
    // esses não passam pela gaveta física da loja.
    const isPdvChannel = !data.channel || data.channel === 'PDV';
    if (data.paymentMethod === 'CASH' && isPdvChannel && !openCash) {
      throw new ForbiddenException(
        'Nenhum caixa aberto — abra o caixa em Financeiro antes de registrar vendas em dinheiro.',
      );
    }

    const productsIds = data.items.map((item) => item.productId);

    const products = await this.prisma.product.findMany({
      where: {
        id: {
          in: productsIds,
        },

        companyId: data.companyId,
      },
    });

    const productsMap = new Map(
      products.map((product) => [product.id, product]),
    );

    let subtotal = 0;

    const orderItemsData = data.items.map((item) => {
      const product = productsMap.get(item.productId);

      if (!product) {
        throw new NotFoundException('Produto não encontrado');
      }

      const quantity = Number(item.quantity);

      // Usa o preço enviado pelo frontend quando válido (ex: tamanho de pizza
      // selecionado pelo PizzaBuilder). Fallback para product.salePrice do banco
      // para itens simples ou quando o frontend não envia unitPrice.
      const sentUnitPrice =
        item.unitPrice != null && Number(item.unitPrice) > 0
          ? Number(item.unitPrice)
          : null;

      const unitPrice = sentUnitPrice ?? Number(product.salePrice || 0);

      // Include complement prices in item subtotal
      const complementsExtra = Array.isArray(item.complements)
        ? item.complements.reduce(
            (s: number, c: any) =>
              s + Number(c.price ?? 0) * Number(c.quantity ?? 1),
            0,
          )
        : 0;

      const itemSubtotal = quantity * unitPrice + complementsExtra * quantity;

      subtotal += itemSubtotal;

      return {
        productId: product.id,

        quantity,

        unitPrice,

        subtotal: itemSubtotal,

        notes: item.notes,

        companyId: data.companyId,

        // Mesmo padrão de override do unitPrice acima: usa o nome enviado
        // pelo frontend quando presente (ex: pizza meio-a-meio, onde o
        // "produto" vendido não corresponde 1:1 a nenhum Product real —
        // productId aponta só pro 1º sabor, usado pra receita/estoque/CMV).
        // Fallback pro nome real do banco cobre itens simples e qualquer
        // caller que não envie o campo (ex: WhatsApp/Kely, /orders/public).
        productName: (item.productName && String(item.productName).trim()) || product.name,

        productSku: product.sku,

        productCost: product.costPrice,
      };
    });

    // Zone lookup: resolve deliveryFee + driverFee from DeliveryZone when orderType=DELIVERY
    let deliveryFee = Number(data.deliveryFee || 0);
    let driverFee: number | undefined;
    let deliveryZoneId: string | undefined = data.deliveryZoneId ?? undefined;

    if (
      (data.orderType === 'DELIVERY' || !data.orderType) &&
      this.deliveryConfigService
    ) {
      const neighborhood = data.neighborhood ?? null;
      let zone: { id: string; clientFee: any; driverShare: any } | null = null;

      if (deliveryZoneId) {
        // Frontend already resolved the zone — just load it to get driverShare
        zone = await this.prisma.deliveryZone.findFirst({
          where: {
            id: deliveryZoneId,
            companyId: data.companyId,
            isActive: true,
          },
          select: { id: true, clientFee: true, driverShare: true },
        });
      } else {
        zone = await this.deliveryConfigService.resolveDeliveryFee(data.companyId, {
          neighborhood,
          addressLine: data.deliveryAddress || null,
        });
      }

      if (zone) {
        // Override fee only when frontend sent 0 (menu always sends 0)
        if (deliveryFee === 0) deliveryFee = Number(zone.clientFee);
        driverFee = Number(zone.driverShare);
        deliveryZoneId = zone.id;
      }
    }

    // Desconto manual (ex: DiscountRow do PDV) — nunca confiar em "total" vindo
    // pronto do cliente; recalcular a partir de subtotal+deliveryFee-discount
    // igual sempre foi feito, só que agora contando o desconto.
    const discount = Math.min(
      Math.max(Number(data.discount || 0), 0),
      subtotal + deliveryFee,
    );

    const total = subtotal + deliveryFee - discount;

    const order = await this.prisma.$transaction(
      async (tx) => {
        // 1a. Próximo número sequencial por tenant
        const lastOrder = await tx.order.findFirst({
          where: { companyId: data.companyId },
          orderBy: { number: 'desc' },
          select: { number: true },
        });
        const nextNumber = (lastOrder?.number ?? 0) + 1;

        // 1b. Create the Order without nested items
        const createdOrder = await tx.order.create({
          data: {
            number: nextNumber,

            customerId: data.customerId ?? null,

            paymentMethod: data.paymentMethod,

            subtotal,

            deliveryFee,

            discount,

            ...(driverFee !== undefined && { driverFee }),

            ...(deliveryZoneId && { deliveryZoneId }),

            total,

            notes: data.notes,

            status: OrderStatus.PENDING,

            companyId: data.companyId,

            orderType: data.orderType || 'DINE_IN',

            customerName: data.customerName || null,

            customerPhone: data.customerPhone || null,

            deliveryAddress: data.deliveryAddress || null,

            neighborhood: data.neighborhood || null,

            ...(data.tableId && { tableId: data.tableId }),

            ...(openCash && { cashId: openCash.id }),

            ...(data.channel && { channel: data.channel }),
            ...(data.externalOrderId && {
              externalOrderId: data.externalOrderId,
            }),
          },

          include: {
            customer: true,
          },
        });

        // 2. DINE_IN: localizar a mesa pelo tableId (direto) ou tableNumber e marcar OCCUPIED
        if (data.orderType === 'DINE_IN' || !data.orderType) {
          if (data.tableId) {
            await tx.table
              .update({
                where: { id: data.tableId },
                data: { status: 'OCCUPIED' },
              })
              .catch(() => {});
          } else if (data.tableNumber) {
            const table = await tx.table.findFirst({
              where: {
                companyId: data.companyId,
                number: Number(data.tableNumber),
              },
              select: { id: true },
            });
            if (table) {
              await tx.table.update({
                where: { id: table.id },
                data: { status: 'OCCUPIED' },
              });
            }
          }
        }

        // 2b. Create each OrderItem individually
        const createdItems: any[] = [];

        for (let i = 0; i < orderItemsData.length; i++) {
          const createdItem = await tx.orderItem.create({
            data: {
              ...orderItemsData[i],
              orderId: createdOrder.id,
            },
          });

          createdItems.push(createdItem);

          // 3. Create complements for THIS specific item
          const comps: any[] = Array.isArray(data.items[i].complements)
            ? data.items[i].complements
            : [];

          for (const comp of comps) {
            await tx.orderItemComplement.create({
              data: {
                orderItemId: createdItem.id,

                complementOptionId: comp.complementOptionId,

                complementName: comp.complementName,

                optionName: comp.optionName,

                price: Number(comp.price ?? 0),

                quantity: Number(comp.quantity ?? 1),
              },
            });
          }
        }

        return {
          ...createdOrder,
          items: createdItems,
        };
      },

      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    this.socketGateway.emitOrderCreated(order);

    const dashboard = await this.dashboard(data.companyId);

    this.socketGateway.emitDashboardUpdate(data.companyId, dashboard);

    // ── QR Recovery — gerar cupom de recuperação (fire-and-forget) ──────────
    // Detecta canal: integrationOrders têm channel != 'PDV'
    setImmediate(async () => {
      try {
        if (!this.qrCampaigns) return;
        const orderSource = (data as any).channel ?? 'PROPRIO';
        const phone = order.customer?.phone ?? (data as any).customerPhone;
        const isFirstOrder = phone
          ? (await this.prisma.order.count({ where: { companyId: data.companyId, customer: { phone } } })) <= 1
          : false;
        const qr = await this.qrCampaigns.generateForOrder({
          companyId:    data.companyId,
          orderId:      order.id,
          orderSource,
          customerName: order.customer?.name ?? `Pedido #${order.number}`,
          customerPhone: phone,
          isFirstOrder,
        });
        if (qr) console.log(`[QR] token=${qr.token} gerado para order=${order.id} source=${orderSource}`);
      } catch (e: any) {
        console.warn(`[QR] falha ao gerar cupom para order=${order.id}: ${e?.message}`);
      }
    });

    // ── Cliente Fiel — detectar marco de N pedidos (fire-and-forget) ────────
    setImmediate(async () => {
      try {
        if (!this.loyaltyMilestones) return;
        const phone = order.customer?.phone ?? (data as any).customerPhone;
        await this.loyaltyMilestones.checkAndRegisterMilestone(
          data.companyId,
          phone,
          order.customer?.name ?? (data as any).customerName,
        );
      } catch (e: any) {
        console.warn(`[ClienteFiel] falha ao checar marco para order=${order.id}: ${e?.message}`);
      }
    });

    // ── Impressão automática via Printer Agent (fire-and-forget) ─────────────
    // Só enfileira se a empresa tiver um Agent online (heartbeat < 90s); caso
    // contrário zero overhead e comportamento idêntico ao atual (window.print()
    // no frontend continua sendo o fallback pra quem não tem Agent instalado).
    setImmediate(async () => {
      try {
        await this.enqueuePrintJobs(data.companyId, order, data.channel);
      } catch (e: any) {
        console.warn(`[print] falha ao enfileirar impressão para order=${order.id}: ${e?.message}`);
      }
    });

    return order;
  }

  /**
   * Classifica os itens do pedido por setor (mesma regra do
   * frontend/components/printing/PrintRouterService.ts: categoryType
   * "bebidas" → BAR, demais → KITCHEN) e delega o enfileiramento pro
   * PrintersService.enqueueSectorJobs — que já deduplica por impressora
   * física (loja com 1 impressora só nunca recebe 2-3 tickets do mesmo
   * pedido, ver comentário lá). Mantenha as duas regras em sincronia caso
   * uma mude.
   */
  private async enqueuePrintJobs(
    companyId: string,
    order: any,
    channel?: string,
  ) {
    if (!this.printersService) return;
    if (!this.printersService.getAgentStatus(companyId).online) return;

    const orderItems = Array.isArray(order.items) ? order.items : [];
    if (orderItems.length === 0) return;

    const productIds = orderItems.map((it: any) => it.productId);
    const [products, company] = await Promise.all([
      this.prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, category: { select: { categoryType: true } } },
      }),
      this.prisma.company.findUnique({
        where: { id: companyId },
        select: { name: true },
      }),
    ]);
    const typeMap = new Map(
      products.map((p) => [p.id, p.category?.categoryType ?? 'normal']),
    );

    const kitchenItems: any[] = [];
    const barItems: any[] = [];
    for (const item of orderItems) {
      const bucket =
        typeMap.get(item.productId) === 'bebidas' ? barItems : kitchenItems;
      bucket.push({ quantity: item.quantity, name: item.productName });
    }

    const basePayload = {
      companyName: company?.name,
      orderNumber: order.number,
      source: channel ?? 'PDV',
      orderType: order.orderType,
      time: new Date().toLocaleTimeString('pt-BR'),
      total: Number(order.total),
      paymentMethod: order.paymentMethod,
      deliveryAddress: order.deliveryAddress,
    };

    const sectorJobs: Array<{ role: 'KITCHEN' | 'BAR' | 'COUNTER' | 'DELIVERY'; items: any[] }> = [];
    if (kitchenItems.length) sectorJobs.push({ role: 'KITCHEN', items: kitchenItems });
    if (barItems.length) sectorJobs.push({ role: 'BAR', items: barItems });
    sectorJobs.push({ role: 'COUNTER', items: [...kitchenItems, ...barItems] });
    if (order.orderType === 'DELIVERY') {
      sectorJobs.push({ role: 'DELIVERY', items: [...kitchenItems, ...barItems] });
    }

    await this.printersService.enqueueSectorJobs(
      companyId,
      order.id,
      sectorJobs,
      basePayload,
    );

    // Notify all connected printer agents in real time
    if (this.printersGateway) {
      this.printersGateway.notifyNewJobs(companyId);
    }
  }

  async customerLookup(phone: string, companyId: string) {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 8) return null;

    const candidates = buildPhoneCandidates(digits);

    // 1. Busca Customer diretamente por telefone
    const customer = await this.prisma.customer.findFirst({
      where: {
        companyId,
        OR: candidates.map((c) => ({ phone: { contains: c } })),
      },
    });

    // 2. Busca último pedido não-cancelado pelo telefone
    const order = await this.prisma.order.findFirst({
      where: {
        companyId,
        status: { not: 'CANCELLED' as any },
        OR: [
          ...candidates.map((c) => ({ customerPhone: { contains: c } })),
          ...candidates.map((c) => ({ customer: { phone: { contains: c } } })),
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: { customer: true },
    });

    if (!customer && !order) return null;

    const name =
      customer?.name || order?.customer?.name || order?.customerName || '';

    // Endereço: tenta JSON desagregado (novo formato), cai em string legada
    let rua = '',
      numero = '',
      complemento = '',
      bairro = '',
      cidade = '',
      cep = '';
    const rawAddress = customer?.address || order?.deliveryAddress || '';
    if (rawAddress) {
      try {
        const parsed = JSON.parse(rawAddress);
        rua = parsed.rua || '';
        numero = parsed.numero || '';
        complemento = parsed.complemento || '';
        bairro = parsed.bairro || '';
        cidade = parsed.cidade || '';
        cep = parsed.cep || '';
      } catch {
        rua = rawAddress; // legado: string plana vai para rua
      }
    }

    return {
      name,
      rua,
      numero,
      complemento,
      bairro,
      cidade,
      cep,
      lastOrder: order
        ? { total: Number(order.total), createdAt: order.createdAt }
        : null,
    };
  }

  async customerAddressSave(
    phone: string,
    name: string,
    address: {
      rua: string;
      numero: string;
      complemento: string;
      bairro: string;
      cidade: string;
      cep: string;
    },
    companyId: string,
  ) {
    const digits = phone?.replace(/\D/g, '');
    if (!digits || digits.length < 8) return null;

    const addressJson = JSON.stringify({
      rua: address.rua || '',
      numero: address.numero || '',
      complemento: address.complemento || '',
      bairro: address.bairro || '',
      cidade: address.cidade || '',
      cep: address.cep || '',
    });

    const existing = await this.prisma.customer.findFirst({
      where: { companyId, phone: { contains: digits } },
    });

    if (existing) {
      return this.prisma.customer.update({
        where: { id: existing.id },
        data: { name: name || existing.name, address: addressJson },
      });
    }

    return this.prisma.customer.create({
      data: {
        companyId,
        phone: digits,
        name: name || 'Cliente',
        address: addressJson,
      },
    });
  }

  findAll(companyId: string) {
    return this.prisma.order.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: {
        customer: true,
        items: { include: { selectedComplements: true } },
      },
    });
  }

  async updateStatus(
    id: string,
    status: OrderStatus,
    userId: string,
    companyId: string,
  ) {
    const order = await this.prisma.order.findFirst({
      where: {
        id,
        companyId,
      },

      include: {
        items: {
          include: {
            selectedComplements: true,
            product: { include: { category: { select: { categoryType: true } } } },
          },
        },
        customer: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Pedido não encontrado');
    }

    const updatedOrder = await this.prisma.$transaction(
      async (tx) => {
        if (
          status === OrderStatus.CONFIRMED &&
          order.status === OrderStatus.PENDING
        ) {
          for (const orderItem of order.items) {
            const recipe = await tx.recipe.findFirst({
              where: {
                productId: orderItem.productId,
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

            for (const recipeItem of recipe.items) {
              const quantityToConsume =
                Number(recipeItem.quantity) * Number(orderItem.quantity);

              const ingredientCost = Number(
                recipeItem.ingredient.averageCost || recipeItem.ingredient.cost,
              );

              const totalIngredientCost = ingredientCost * quantityToConsume;

              itemCmv += totalIngredientCost;

              await this.stockService.consumeIngredientTransactional(
                tx,

                {
                  ingredientId: recipeItem.ingredientId,

                  quantity: quantityToConsume,

                  companyId: order.companyId,

                  performedById: userId,

                  reason: `Consumo automático pedido ${order.id}`,

                  referenceId: order.id,

                  referenceType: 'ORDER',
                },
              );
            }

            const subtotal = Number(orderItem.subtotal);

            const profit = subtotal - itemCmv;

            await tx.orderItem.update({
              where: {
                id: orderItem.id,
              },

              data: {
                cmv: itemCmv,

                profit: profit,
              },
            });
          }

          // Antes só creditava se Order.customerId já estivesse preenchido
          // (praticamente nunca — PDV/mesa/WhatsApp só gravam o telefone
          // como texto solto). Agora resolve/cria o Customer pelo telefone,
          // igual já é feito pra "Cliente Fiel" (checkAndRegisterMilestone).
          {
            const phone = order.customer?.phone ?? order.customerPhone;
            const name = order.customer?.name ?? order.customerName;
            if (phone) {
              await this.loyaltyService.processOrderRewardByPhone(
                order.companyId,
                phone,
                name,
                order.id,
                Number(order.total),
              );
            }
          }

          // Credita a venda no saldo físico do caixa SOMENTE quando foi
          // paga em dinheiro de verdade — PIX/cartão não passam pela
          // gaveta, então nunca podem inflar o "Sistema" do fechamento
          // às cegas. Cobre o caminho principal do PDV (balcão/delivery/
          // retirada), que nunca chamava /cash/movement sozinho.
          if (order.paymentMethod === 'CASH' && order.cashId) {
            await tx.cash.updateMany({
              where: { id: order.cashId, isOpen: true },
              data: {
                balance: { increment: Number(order.total) },
                entries: { increment: Number(order.total) },
              },
            });
          }
        }

        if (
          status === OrderStatus.CANCELLED &&
          order.status !== OrderStatus.CANCELLED
        ) {
          for (const orderItem of order.items) {
            const recipe = await tx.recipe.findFirst({
              where: {
                productId: orderItem.productId,
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

            for (const recipeItem of recipe.items) {
              const quantityToRestore =
                Number(recipeItem.quantity) * Number(orderItem.quantity);

              await this.stockService.restoreIngredientTransactional(
                tx,

                {
                  ingredientId: recipeItem.ingredientId,

                  quantity: quantityToRestore,

                  companyId: order.companyId,

                  performedById: userId,

                  reason: `Rollback cancelamento pedido ${order.id}`,

                  referenceId: order.id,

                  referenceType: 'ORDER',
                },
              );
            }
          }

          // Estorna o crédito de caixa SE E SOMENTE SE o pedido já tinha
          // passado por CONFIRMED antes (senão nunca foi creditado — evita
          // debitar dinheiro que nunca entrou no saldo).
          if (
            order.status !== OrderStatus.PENDING &&
            order.paymentMethod === 'CASH' &&
            order.cashId
          ) {
            await tx.cash.updateMany({
              where: { id: order.cashId, isOpen: true },
              data: {
                balance: { decrement: Number(order.total) },
                exits: { increment: Number(order.total) },
              },
            });
          }
        }

        const timestamps: any = {};

        if (status === OrderStatus.CONFIRMED) {
          timestamps.confirmedAt = new Date();
        }
        if (status === OrderStatus.PREPARING) {
          timestamps.preparingAt = new Date();
        }
        if (status === OrderStatus.READY) {
          timestamps.readyAt = new Date();
        }
        if (status === OrderStatus.OUT_FOR_DELIVERY) {
          timestamps.outForDeliveryAt = new Date();
        }
        if (status === OrderStatus.DELIVERED) {
          timestamps.deliveredAt = new Date();
          timestamps.completedAt = new Date();
        }
        if (status === OrderStatus.CANCELLED) {
          timestamps.cancelledAt = new Date();
        }

        const updated = await tx.order.update({
          where: {
            id,
          },

          data: {
            status,
            ...timestamps,
          },
        });

        // Auto-free-table: libera mesa quando não restam pedidos ativos
        const isTerminal =
          status === OrderStatus.DELIVERED || status === OrderStatus.CANCELLED;
        if (isTerminal && order.tableId) {
          const activeCount = await tx.order.count({
            where: {
              tableId: order.tableId,
              id: { not: id },
              status: { notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] },
            },
          });
          if (activeCount === 0) {
            await tx.table
              .update({
                where: { id: order.tableId },
                data: { status: 'FREE' },
              })
              .catch(() => {});
          }
        }

        return updated;
      },

      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    // ── Driver Earning: cria apenas em DELIVERY entregue com entregador e taxa ──
    if (
      status === OrderStatus.DELIVERED &&
      order.orderType === 'DELIVERY' &&
      order.driverId &&
      Number(order.driverFee) > 0
    ) {
      setImmediate(async () => {
        try {
          const customerFee = Number(order.deliveryFee);
          const driverAmount = Number(order.driverFee);
          const platformFee = Math.max(0, customerFee - driverAmount);
          await this.prisma.driverEarning.upsert({
            where: { orderId: id },
            create: {
              orderId: id,
              companyId: order.companyId,
              driverProfileId: order.driverId!,
              customerFee,
              driverAmount,
              platformFee,
            },
            update: {},
          });
        } catch (e) {
          console.error(
            `[OrdersService] DriverEarning falhou para pedido ${id}:`,
            e,
          );
        }
      });
    }

    this.socketGateway.emitKitchenUpdate(updatedOrder);
    this.socketGateway.emitOrderStatusChanged(id, {
      status: updatedOrder.status,
      source: 'PDV',
    });

    const dashboard = await this.dashboard(order.companyId);

    this.socketGateway.emitDashboardUpdate(order.companyId, dashboard);

    const customerPhone = order.customerPhone ?? order.customer?.phone;
    const customerName = order.customerName ?? order.customer?.name;
    const notifyStatuses = [
      'CONFIRMED',
      'PREPARING',
      'READY',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'CANCELLED',
    ];

    if (
      this.orderNotificationService &&
      customerPhone &&
      notifyStatuses.includes(status)
    ) {
      setImmediate(async () => {
        try {
          if (status === 'CONFIRMED') {
            // Notificação rica de confirmação (itens, total, pagamento, endereço)
            await this.orderNotificationService!.notifyOrderConfirmed({
              companyId: order.companyId,
              orderId: order.id,
              customerPhone,
              customerName: customerName ?? undefined,
              orderType: (order as any).orderType ?? undefined,
              items: order.items.map((i: any) => ({
                name: i.productName ?? 'Item',
                quantity: Number(i.quantity),
                unitPrice: Number(i.unitPrice ?? 0),
                categoryType: i.product?.category?.categoryType ?? null,
                complements: (i.selectedComplements ?? []).map((c: any) => ({
                  name: c.optionName,
                  price: Number(c.price ?? 0),
                })),
              })),
              subtotal: Number(order.subtotal),
              deliveryFee: Number(order.deliveryFee ?? 0),
              total: Number(order.total),
              paymentMethod: String(order.paymentMethod ?? 'PIX'),
              address: order.deliveryAddress ?? undefined,
            });
          } else {
            // Notificação curta de mudança de status (PREPARING, READY, etc.)
            await this.orderNotificationService!.notifyStatusChange({
              companyId: order.companyId,
              orderId: order.id,
              customerPhone,
              customerName: customerName ?? undefined,
              newStatus: status as any,
              orderType: order.orderType ?? undefined,
            });
          }
        } catch {
          /* silent — nunca bloqueia o fluxo principal */
        }
      });
    }

    // ── Feedback pós-entrega (pergunta antes de mandar o link do Google) ────
    // Espera 15min antes de perguntar "como ficou?" — dar tempo da pessoa
    // comer antes de ser abordada (pedido explícito do usuário). Nota: é um
    // setTimeout em memória, não durável — se o backend reiniciar dentro
    // dessa janela de 15min (comum em dias de deploy), a pergunta desse
    // pedido específico não sai; não há cron de segurança pra este estágio
    // (só existe pro reenvio do link após a pergunta já ter sido feita).
    if (status === 'DELIVERED' && customerPhone) {
      setTimeout(() => {
        this.whatsappAiService
          ?.requestDeliveryFeedback({
            companyId: order.companyId,
            orderId: order.id,
            orderSource: 'PDV',
            customerPhone,
            customerName,
          })
          .catch(() => {
            /* silent — não bloqueia fluxo */
          });
      }, 15 * 60 * 1000);
    }

    return updatedOrder;
  }

  async publicTrack(orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId },
      select: {
        id: true,
        number: true,
        status: true,
        total: true,
        deliveryFee: true,
        orderType: true,
        createdAt: true,
        confirmedAt: true,
        preparingAt: true,
        readyAt: true,
        outForDeliveryAt: true,
        deliveredAt: true,
        cancelledAt: true,
        items: {
          select: { productName: true, quantity: true, unitPrice: true },
        },
        driver: {
          select: {
            user: { select: { name: true } },
            currentLat: true,
            currentLng: true,
          },
        },
        company: { select: { name: true } },
      },
    });

    if (!order) throw new NotFoundException('Pedido não encontrado');

    return order;
  }

  /**
   * Edição pós-criação de forma de pagamento e/ou conversão retirada<->entrega.
   * Cenário real que motivou isso: operador lançou o pedido como "cartão",
   * cliente pagou em dinheiro na hora da retirada, e não havia como corrigir
   * -- o caixa fechava sem contar esse dinheiro físico que realmente entrou.
   *
   * Ajusta o caixa pela DIFERENÇA entre o que already estava contado (se já
   * passou por CONFIRMED e tem cashId) e o que deveria estar contado agora,
   * cobrindo os 3 casos possíveis numa única conta: trocou só a forma de
   * pagamento, trocou só o tipo (mudando o total pela taxa de entrega), ou
   * os dois ao mesmo tempo.
   */
  async updateOrderDetails(
    id: string,
    companyId: string,
    dto: {
      paymentMethod?: string;
      orderType?: string;
      deliveryAddress?: string;
      neighborhood?: string;
      customerName?: string;
      customerPhone?: string;
      discount?: number;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({ where: { id, companyId } });
      if (!order) throw new NotFoundException('Pedido não encontrado');
      if (order.status === OrderStatus.CANCELLED) {
        throw new ForbiddenException(
          'Pedido cancelado não pode ser editado.',
        );
      }

      const data: Record<string, any> = {};
      let newTotal = Number(order.total);

      // ── Nome/telefone do cliente ──────────────────────────────────────
      // Snapshot no pedido — cliente informou errado na hora, ou pedido
      // veio do WhatsApp sem telefone capturado corretamente.
      if (dto.customerName !== undefined) {
        data.customerName = dto.customerName.trim() || null;
      }
      if (dto.customerPhone !== undefined) {
        data.customerPhone = dto.customerPhone.trim() || null;
      }

      // ── Conversão retirada <-> entrega ──────────────────────────────────
      if (dto.orderType && dto.orderType !== order.orderType) {
        if (
          order.status === OrderStatus.OUT_FOR_DELIVERY ||
          order.status === OrderStatus.DELIVERED
        ) {
          throw new ForbiddenException(
            'Não é possível trocar o tipo de um pedido já despachado/entregue.',
          );
        }

        let deliveryFee = 0;
        let driverFee: number | null = null;
        let deliveryZoneId: string | null = null;
        let deliveryAddress: string | null = order.deliveryAddress;
        let neighborhood: string | null = order.neighborhood;

        if (dto.orderType === 'DELIVERY') {
          if (!dto.deliveryAddress?.trim()) {
            throw new ForbiddenException(
              'Endereço de entrega é obrigatório para converter em entrega.',
            );
          }
          deliveryAddress = dto.deliveryAddress.trim();
          neighborhood = dto.neighborhood?.trim() || null;
          if (this.deliveryConfigService) {
            const zone = await this.deliveryConfigService.resolveDeliveryFee(companyId, {
              neighborhood,
              addressLine: deliveryAddress,
            });
            if (zone) {
              deliveryFee = Number(zone.clientFee);
              driverFee = zone.driverShare != null ? Number(zone.driverShare) : null;
              deliveryZoneId = zone.id;
            }
          }
        } else {
          deliveryAddress = null;
          neighborhood = null;
        }

        newTotal = Number(order.subtotal) - Number(order.discount) + deliveryFee;
        data.orderType = dto.orderType as any;
        data.deliveryFee = deliveryFee;
        data.driverFee = driverFee;
        data.deliveryZoneId = deliveryZoneId;
        data.deliveryAddress = deliveryAddress;
        data.neighborhood = neighborhood;
        data.total = newTotal;
      }

      // ── Desconto manual pós-criação ──────────────────────────────────────
      // Ex: cliente pagou em dinheiro e o caixa não tinha troco — abate a
      // diferença no pedido já criado (antes só dava pra aplicar desconto na
      // hora de fechar no PDV, nunca depois). Usa o deliveryFee já resolvido
      // acima (se orderType mudou nesta mesma chamada) para não recalcular
      // com um valor de taxa desatualizado.
      if (dto.discount !== undefined) {
        const effectiveDeliveryFee =
          data.deliveryFee !== undefined ? Number(data.deliveryFee) : Number(order.deliveryFee);
        const newDiscount = Math.max(0, Number(dto.discount));
        const maxDiscount = Number(order.subtotal) + effectiveDeliveryFee;
        if (newDiscount > maxDiscount) {
          throw new BadRequestException(
            `Desconto não pode ser maior que o valor do pedido (máx R$ ${maxDiscount.toFixed(2)}).`,
          );
        }
        newTotal = Number(order.subtotal) - newDiscount + effectiveDeliveryFee;
        data.discount = newDiscount;
        data.total = newTotal;
      }

      // ── Troca de forma de pagamento ──────────────────────────────────────
      const newPaymentMethod = dto.paymentMethod ?? order.paymentMethod;
      if (dto.paymentMethod) {
        data.paymentMethod = dto.paymentMethod as any;
      }

      // ── Reconciliação do caixa ───────────────────────────────────────────
      // Só mexe se o pedido já passou por CONFIRMED (já teria afetado o
      // caixa uma vez) e ainda está vinculado a uma sessão de caixa.
      const alreadyHitCash = order.status !== OrderStatus.PENDING && !!order.cashId;
      if (alreadyHitCash) {
        const oldContribution =
          order.paymentMethod === 'CASH' ? Number(order.total) : 0;
        const newContribution =
          newPaymentMethod === 'CASH' ? newTotal : 0;
        const delta = newContribution - oldContribution;

        if (delta > 0) {
          await tx.cash.updateMany({
            where: { id: order.cashId!, isOpen: true },
            data: {
              balance: { increment: delta },
              entries: { increment: delta },
            },
          });
        } else if (delta < 0) {
          await tx.cash.updateMany({
            where: { id: order.cashId!, isOpen: true },
            data: {
              balance: { decrement: -delta },
              exits: { increment: -delta },
            },
          });
        }
      }

      if (Object.keys(data).length === 0) return order;

      return tx.order.update({ where: { id }, data });
    });
  }

  /**
   * KPIs do dashboard (hoje). Unifica Order (PDV/mesa/WhatsApp) + OnlineOrder
   * (cardápio digital/totem) via ReportsService.getRevenue — antes essa
   * função só consultava `Order`, então toda loja que recebe pedido pelo
   * cardápio digital (o canal mais comum) tinha "Pedidos"/"Vendas" no
   * dashboard subestimados (achado real: 3 pedidos reais no dia, painel
   * mostrando só 1). Também exclui CANCELLED da contagem, que o método
   * antigo incluía por engano.
   *
   * Os nomes de campo abaixo (`revenue`, `averageTicket`, `totalProfit`,
   * `totalCmv`, `margin`) espelham exatamente o que os 2 consumidores do
   * frontend leem (`app/page.tsx` e `app/dashboard/page.tsx`) — nenhum dos
   * dois lia `totalRevenue` sozinho, então "Vendas"/"Ticket Médio" ficavam
   * sempre R$ 0 independente de venda real, bug separado da subestimação.
   */
  async dashboard(companyId: string) {
    const today = getStartOfTodayBrazil();
    const now = new Date();

    if (this.reportsService) {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 6);
      const [report, weekReport] = await Promise.all([
        this.reportsService.getRevenue(companyId, { from: today, to: now }),
        this.reportsService.getRevenue(companyId, { from: weekAgo, to: now }),
      ]);
      return {
        totalOrders: report.orderCount,
        totalRevenue: report.totalRevenue,
        revenue: report.totalRevenue,
        averageTicket: report.avgTicket,
        totalProfit: report.grossProfit,
        totalCmv: report.totalCmv,
        margin: report.grossMargin * 100,
        weekSeries: buildWeekSeries(weekAgo, weekReport.dailySeries),
      };
    }

    // Fallback defensivo — nunca deve rodar em produção (ReportsModule
    // sempre importado), mantido só por robustez caso a injeção falhe.
    const orders = await this.prisma.order.findMany({
      where: { companyId, createdAt: { gte: today }, status: { not: OrderStatus.CANCELLED } },
    });
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((acc, order) => acc + Number(order.total), 0);
    return {
      totalOrders,
      totalRevenue,
      revenue: totalRevenue,
      averageTicket: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      totalProfit: 0,
      totalCmv: 0,
      margin: 0,
      weekSeries: [],
    };
  }

  static readonly KITCHEN_STATUSES = [
    'PENDING',
    'CONFIRMED',
    'PREPARING',
    'READY',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'CANCELLED',
  ] as const;

  private mapOnlineStatusToKitchen(s: string): string {
    switch (s) {
      case 'DELIVERING':
        return 'OUT_FOR_DELIVERY';
      case 'COMPLETED':
        return 'DELIVERED';
      case 'CANCELED':
        return 'CANCELLED';
      default:
        return s;
    }
  }

  private mapKitchenStatusToOnline(s: string): string {
    switch (s) {
      case 'OUT_FOR_DELIVERY':
        return 'DELIVERING';
      case 'DELIVERED':
        return 'COMPLETED';
      case 'CANCELLED':
        return 'CANCELED';
      default:
        return s;
    }
  }

  async findAllForKitchen(companyId: string) {
    const [pdvOrders, onlineOrdersRaw] = await Promise.all([
      this.prisma.order.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: {
          customer: true,
          driver: { include: { user: { select: { name: true } } } },
          items: {
            include: {
              selectedComplements: true,
              product: {
                include: { category: { select: { categoryType: true } } },
              },
            },
          },
        },
      }),
      this.prisma.onlineOrder.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
    ]);

    // Batch-resolve categoryType for online order items (stored as JSON, no direct relation)
    const onlineProductIds = new Set<string>();
    for (const o of onlineOrdersRaw) {
      const rawItems: any[] = Array.isArray((o as any).items)
        ? (o as any).items
        : [];
      rawItems.forEach((it: any) => {
        if (it.productId) onlineProductIds.add(it.productId);
      });
    }
    const categoryByProductId = new Map<string, string>();
    if (onlineProductIds.size > 0) {
      const products = await this.prisma.product.findMany({
        where: { id: { in: [...onlineProductIds] }, companyId },
        include: { category: { select: { categoryType: true } } },
      });
      products.forEach((p: any) => {
        categoryByProductId.set(p.id, p.category?.categoryType ?? 'normal');
      });
    }

    const pdv = pdvOrders.map((o: any) => ({
      id: o.id,
      source: (o.channel && o.channel !== 'PDV' ? o.channel : 'PDV') as string,
      status: o.status,
      productionStatus: o.productionStatus ?? null,
      createdAt: o.createdAt,
      customerName: o.customer?.name ?? o.customerName ?? null,
      customerPhone: o.customer?.phone ?? o.customerPhone ?? null,
      deliveryAddress: o.deliveryAddress ?? o.customer?.address ?? null,
      orderType: o.orderType ?? 'DINE_IN',
      subtotal: Number(o.subtotal ?? o.total),
      discount: Number(o.discount ?? 0),
      total: Number(o.total),
      paymentMethod: o.paymentMethod ?? null,
      notes: o.notes ?? null,
      driverId: o.driverId ?? null,
      driverName: o.driver?.user?.name ?? null,
      items: (o.items ?? []).map((it: any) => ({
        productName: it.productName,
        quantity: it.quantity,
        notes: it.notes ?? '',
        unitPrice: Number(it.unitPrice ?? 0),
        subtotal: Number(it.subtotal ?? 0),
        categoryType: it.product?.category?.categoryType ?? 'normal',
        selectedComplements: (it.selectedComplements ?? []).map((c: any) => ({
          complementName: c.complementName,
          optionName: c.optionName,
          price: Number(c.price),
          quantity: c.quantity,
        })),
      })),
    }));

    const online = onlineOrdersRaw.map((o: any) => {
      const rawItems: any[] = Array.isArray(o.items) ? o.items : [];
      return {
        id: o.id,
        source: 'ONLINE' as const,
        // Distingue Totem de pedido online comum — só afeta impressão no
        // frontend (não imprime pré-conta pro cliente do totem). O
        // roteamento de status acima continua chaveado por source==='ONLINE'.
        channel: (o.channel ?? 'ONLINE') as string,
        status: this.mapOnlineStatusToKitchen(o.orderStatus),
        productionStatus: null,
        createdAt: o.createdAt,
        customerName: o.customerName ?? null,
        customerPhone: o.customerPhone ?? null,
        deliveryAddress:
          [o.address, o.addressNumber, o.neighborhood, o.city]
            .filter(Boolean)
            .join(', ') || null,
        orderType: o.orderType ?? 'DELIVERY',
        total: Number(o.total),
        paymentMethod: o.paymentMethod ?? null,
        // Pedido online paga via PIX/cartão pela própria plataforma (Mercado
        // Pago) -- diferente do PDV, onde paymentMethod só descreve COMO vai
        // pagar na entrega. Sem isso o operador não sabia se precisava
        // cobrar na entrega ou se já estava quitado.
        paymentStatus: o.paymentStatus ?? null,
        notes: o.notes ?? null,
        items: rawItems.map((it: any) => ({
          productName: it.productName,
          quantity: Number(it.quantity ?? 1),
          notes: it.notes ?? '',
          unitPrice: Number(it.unitPrice ?? 0),
          subtotal: Number(it.unitPrice ?? 0) * Number(it.quantity ?? 1),
          categoryType: categoryByProductId.get(it.productId) ?? 'normal',
          selectedComplements: Array.isArray(it.complements)
            ? it.complements.map((c: any) => ({
                complementName: c.complementName,
                optionName: c.optionName,
                price: Number(c.price ?? 0),
                quantity: Number(c.quantity ?? 1),
              }))
            : [],
        })),
      };
    });

    return [...pdv, ...online].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

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

    // Todos os canais que armazenam em Order (PDV, IFOOD, RAPPI, MOCK, WHATSAPP)
    if (source !== 'ONLINE') {
      return this.updateStatus(id, status as OrderStatus, userId, companyId);
    }

    if (source === 'ONLINE') {
      const mapped = this.mapKitchenStatusToOnline(status);
      const onlineOrder = await this.prisma.onlineOrder.findFirst({
        where: { id, companyId },
        select: {
          id: true,
          orderStatus: true,
          customerPhone: true,
          customerName: true,
          total: true,
          instantCashbackApplied: true,
        },
      });
      if (!onlineOrder)
        throw new NotFoundException('Pedido online não encontrado.');

      // Consumo de estoque ANTES de gravar o novo status: se faltar
      // ingrediente, a transição é bloqueada (erro visível pro operador),
      // igual ao comportamento do PDV — em vez de confirmar e nunca
      // decrementar nada (bug anterior). Idempotente: chamada dupla para o
      // mesmo pedido não consome duas vezes.
      if (mapped === 'CONFIRMED' && onlineOrder.orderStatus !== 'CONFIRMED') {
        await this.onlineOrdersService?.consumeStockForOrder(id, companyId, userId);

        // Fidelidade — pedido do cardápio digital nunca creditava pontos
        // (só o PDV/WhatsApp tinham o hook, e mesmo assim quebrado, ver
        // acima). Mesmo gatilho "após confirmado", nunca em PENDING.
        if (onlineOrder.customerPhone) {
          this.loyaltyService
            .processOrderRewardByPhone(
              companyId,
              onlineOrder.customerPhone,
              onlineOrder.customerName,
              onlineOrder.id,
              Number(onlineOrder.total),
              { skipCashback: onlineOrder.instantCashbackApplied },
            )
            .catch((e: any) =>
              this.logger.warn(`[ONLINE] fidelidade falhou (${id}): ${e?.message}`),
            );
        }
      }

      const updated = await this.prisma.onlineOrder.update({
        where: { id },
        data: { orderStatus: mapped as any },
      });

      if (mapped === 'CANCELED') {
        this.onlineOrdersService
          ?.restoreStockForOrder(id, companyId, userId)
          .catch((e: any) =>
            this.logger.warn(`[ONLINE] restauração de estoque falhou (${id}): ${e?.message}`),
          );
      }

      try {
        this.socketGateway.emitKitchenUpdate({
          companyId,
          id,
          status,
          source: 'ONLINE',
        } as any);
        this.socketGateway.emitDashboardUpdate(companyId, {});
        this.socketGateway.emitOrderStatusChanged(id, {
          status,
          source: 'ONLINE',
        });
      } catch {
        /* socket failure must not block */
      }

      // ── Notificação WhatsApp em TODA mudança de status (pedido online) ──────
      // Antes só o PDV notificava — pedido do cardápio/totem/iFood nunca
      // avisava o cliente de PREPARING/READY/OUT_FOR_DELIVERY etc., só na
      // criação. Reaproveita o mesmo serviço/templates do PDV.
      const notifyStatuses = [
        'CONFIRMED',
        'PREPARING',
        'READY',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
        'CANCELLED',
      ];
      if (this.orderNotificationService && notifyStatuses.includes(status)) {
        setImmediate(async () => {
          try {
            const fullOrder = await this.prisma.onlineOrder.findUnique({
              where: { id },
            });
            if (!fullOrder?.customerPhone) return;

            if (status === 'CONFIRMED') {
              // Mesma mensagem rica do PDV (itens/subtotal/taxa/total/
              // pagamento) -- antes, pedido online só recebia o "foi
              // confirmado!" genérico de 1 linha, nunca o recibo detalhado.
              const rawItems: any[] = Array.isArray(fullOrder.items)
                ? (fullOrder.items as any[])
                : [];
              const address =
                fullOrder.orderType === 'DELIVERY'
                  ? [fullOrder.address, fullOrder.addressNumber, fullOrder.neighborhood]
                      .filter(Boolean)
                      .join(', ')
                  : undefined;
              // Batch lookup de categoria (mesmo padrão de enqueuePrintJobs)
              // pra agrupar o cupom-imagem em seções PIZZAS/BEBIDAS/etc.
              const productIds = rawItems
                .map((i) => i.productId)
                .filter(Boolean);
              const categoryMap = new Map<string, string>();
              if (productIds.length > 0) {
                const products = await this.prisma.product.findMany({
                  where: { id: { in: productIds } },
                  select: { id: true, category: { select: { categoryType: true } } },
                });
                for (const p of products) {
                  if (p.category?.categoryType) categoryMap.set(p.id, p.category.categoryType);
                }
              }
              await this.orderNotificationService!.notifyOrderConfirmed({
                companyId,
                orderId: id,
                customerPhone: fullOrder.customerPhone,
                customerName: fullOrder.customerName ?? undefined,
                orderType: fullOrder.orderType ?? undefined,
                items: rawItems.map((i) => ({
                  name: i.productName ?? i.name ?? 'Item',
                  quantity: Number(i.quantity ?? 1),
                  unitPrice: Number(i.unitPrice ?? i.price ?? 0),
                  categoryType: i.productId ? categoryMap.get(i.productId) ?? null : null,
                })),
                subtotal: Number(fullOrder.subtotal),
                deliveryFee: Number(fullOrder.deliveryFee ?? 0),
                total: Number(fullOrder.total),
                paymentMethod: String(fullOrder.paymentMethod ?? 'PIX'),
                address,
              });
            } else {
              await this.orderNotificationService!.notifyStatusChange({
                companyId,
                orderId: id,
                customerPhone: fullOrder.customerPhone,
                customerName: fullOrder.customerName ?? undefined,
                newStatus: status as any,
                orderType: fullOrder.orderType ?? undefined,
              });
            }
          } catch {
            /* silent — nunca bloqueia o fluxo principal */
          }
        });
      }

      // Feedback pós-entrega (pergunta antes de mandar o link do Google) —
      // mesma espera de 15min do lado PDV (ver comentário em updateStatus).
      if (status === 'DELIVERED') {
        setTimeout(async () => {
          try {
            const fullOrder = await this.prisma.onlineOrder.findUnique({
              where: { id },
              select: { customerPhone: true, customerName: true },
            });
            if (!fullOrder?.customerPhone) return;
            await this.whatsappAiService?.requestDeliveryFeedback({
              companyId,
              orderId: id,
              orderSource: 'ONLINE',
              customerPhone: fullOrder.customerPhone,
              customerName: fullOrder.customerName,
            });
          } catch {
            /* silent */
          }
        }, 15 * 60 * 1000);
      }

      return { id: updated.id, source: 'ONLINE', status };
    }

    throw new NotFoundException(`Source "${source}" inválida.`);
  }
}
