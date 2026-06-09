import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { SocketGateway } from '@/socket/socket.gateway';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { DeliveryConfigService } from '@/modules/delivery-config/delivery-config.service';

const ORDER_TYPES = ['DELIVERY', 'DINE_IN', 'PICKUP'] as const;
const PAYMENT_METHODS = ['PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH'] as const;

type OnlineOrderType = (typeof ORDER_TYPES)[number];
type OnlinePaymentMethodType = (typeof PAYMENT_METHODS)[number];

export interface CreateOnlineOrderDto {
  companyId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  orderType: OnlineOrderType;
  address?: string;
  addressNumber?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  complement?: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    notes?: string;
    complements?: Array<{
      complementOptionId: string;
      complementName: string;
      optionName: string;
      price: number;
      quantity: number;
    }>;
  }>;
  subtotal: number;
  deliveryFee?: number;
  discount?: number;
  total: number;
  paymentMethod: OnlinePaymentMethodType;
  notes?: string;
}

@Injectable()
export class OnlineOrdersService {
  private readonly logger = new Logger(OnlineOrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly socketGateway: SocketGateway,
    private readonly notifications: NotificationsService,
    private readonly deliveryConfigService: DeliveryConfigService,
  ) {}

  /**
   * Creates an online order.
   *
   * Atomicity guarantee:
   * 1. Validate inputs
   * 2. Persist to DB (prisma.create — awaited, throws on failure)
   * 3. ONLY AFTER DB success → emit socket events to kitchen/dashboard
   *
   * Socket events never fire if DB write fails.
   */
  async create(dto: CreateOnlineOrderDto) {
    // ── 1. Validations ──────────────────────────────────────────────────────
    const company = await this.prisma.company.findUnique({
      where: { id: dto.companyId },
      select: { id: true, isBlocked: true, name: true },
    });

    if (!company) throw new NotFoundException('Empresa não encontrada.');
    if (company.isBlocked)
      throw new BadRequestException('Empresa não está aceitando pedidos.');
    if (!dto.items?.length) throw new BadRequestException('Pedido sem itens.');

    const subtotal = Number(dto.subtotal);
    let deliveryFee = Number(dto.deliveryFee ?? 0);
    const discount = Number(dto.discount ?? 0);
    const orderType = ORDER_TYPES.includes(dto.orderType)
      ? dto.orderType
      : 'DELIVERY';
    const paymentMethod = PAYMENT_METHODS.includes(dto.paymentMethod)
      ? dto.paymentMethod
      : 'PIX';

    // Zone lookup: resolve real deliveryFee for DELIVERY orders (menu always sends 0)
    let deliveryZoneId: string | undefined;
    if (orderType === 'DELIVERY' && dto.neighborhood) {
      const zone = await this.deliveryConfigService.getFeeForNeighborhood(
        dto.companyId,
        dto.neighborhood,
      );
      if (zone) {
        if (deliveryFee === 0) deliveryFee = Number(zone.clientFee);
        deliveryZoneId = zone.id;
      }
    }

    const total = subtotal - discount + deliveryFee;

    if (!isFinite(total) || total <= 0) {
      throw new BadRequestException('Valor total inválido.');
    }

    // ── 1b. Validação server-side de complementos (Fase A — Item 4) ────────
    // Garante required / minOptions / maxOptions / multipleChoice mesmo
    // que o frontend seja burlado. Tudo filtrado por companyId.
    for (const item of dto.items) {
      const groups: any[] = await this.prisma.complement.findMany({
        where: {
          productId: item.productId,
          companyId: dto.companyId,
          isActive: true,
        },
        include: { options: { where: { isActive: true } } },
      });
      if (groups.length === 0) continue;

      // Indexa seleções recebidas por complementName (snapshot enviado pelo client)
      const sentByGroup = new Map<string, Array<{ id: string; qty: number }>>();
      for (const c of item.complements ?? []) {
        const arr = sentByGroup.get(c.complementName) ?? [];
        arr.push({ id: c.complementOptionId, qty: Number(c.quantity) || 1 });
        sentByGroup.set(c.complementName, arr);
      }

      for (const g of groups) {
        const sent = sentByGroup.get(g.name) ?? [];
        const count = sent.length;

        if (g.required && count < Math.max(1, g.minOptions || 1)) {
          throw new BadRequestException(
            `Complemento "${g.name}" é obrigatório para "${item.productName}" (mínimo ${g.minOptions || 1}).`,
          );
        }
        if (count > 0 && g.minOptions > 0 && count < g.minOptions) {
          throw new BadRequestException(
            `Selecione ao menos ${g.minOptions} em "${g.name}".`,
          );
        }
        if (g.maxOptions > 0 && count > g.maxOptions) {
          throw new BadRequestException(
            `Máximo ${g.maxOptions} em "${g.name}" (recebido ${count}).`,
          );
        }
        if (!g.multipleChoice && count > 1) {
          throw new BadRequestException(`"${g.name}" aceita apenas 1 escolha.`);
        }
        // Cada opção enviada precisa existir no grupo (anti-spoof de ID)
        const validIds = new Set<string>(g.options.map((o: any) => o.id));
        for (const s of sent) {
          if (!validIds.has(s.id)) {
            throw new BadRequestException(`Opção inválida em "${g.name}".`);
          }
        }
      }
    }

    // ── 2. Persist to database ─────────────────────────────────────────────
    // This is the ONLY source of truth. Events fire only after this resolves.
    const order = await this.prisma.onlineOrder.create({
      data: {
        companyId: dto.companyId,
        customerName: dto.customerName.trim(),
        customerPhone: dto.customerPhone.trim(),
        customerEmail: dto.customerEmail?.trim() || null,
        orderType,
        address: dto.address?.trim() || null,
        addressNumber: dto.addressNumber?.trim() || null,
        neighborhood: dto.neighborhood?.trim() || null,
        city: dto.city?.trim() || null,
        state: dto.state?.trim() || null,
        zipcode: dto.zipcode?.trim() || null,
        complement: dto.complement?.trim() || null,
        items: dto.items as any,
        subtotal,
        deliveryFee,
        discount,
        total,
        paymentMethod,
        notes: dto.notes?.trim() || null,
      },
    });

    // ── 3. Post-persistence side-effects (non-blocking, guarded) ───────────
    // These run ONLY because the DB write above succeeded.
    // Errors here are logged but do NOT roll back or affect the response.
    setImmediate(() => {
      try {
        // → Kitchen screen picks up new order
        this.socketGateway.emitOrderCreated(order);

        // → Dashboard KPI counters refresh
        this.socketGateway.emitDashboardUpdate(dto.companyId, {
          event: 'onlineOrderCreated',
          orderId: order.id,
          total,
        });

        this.logger.log(
          `[OnlineOrder] id=${order.id} company=${dto.companyId} ` +
            `total=${total} type=${orderType} — socket events emitted`,
        );

        // → New order confirmation email (fire-and-forget — never blocks the order)
        if (order.customerEmail) {
          this.notifications
            .send({
              to: order.customerEmail,
              type: 'NEW_ORDER',
              data: {
                orderId: order.id.slice(-8).toUpperCase(),
                customerName: order.customerName,
                total: Number(order.total).toFixed(2),
                orderType: order.orderType,
              },
            })
            .catch((e: any) =>
              this.logger.warn(`[OnlineOrder] email failed: ${e?.message}`),
            );
        }
      } catch (err: any) {
        // Socket failure must never affect the already-created order
        this.logger.warn(`[OnlineOrder] socket emit failed: ${err?.message}`);
      }
    });

    return order;
  }

  /**
   * Polling do cliente público — retorna apenas info de status.
   * Sem endereço, itens ou dados pessoais. orderId é o "segredo" (cuid 25 chars).
   */
  async getPublicStatus(id: string) {
    const order = await this.prisma.onlineOrder.findUnique({
      where: { id },
      select: {
        id: true,
        orderStatus: true,
        paymentStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!order) throw new NotFoundException('Pedido não encontrado.');
    return order;
  }

  async findOne(id: string, companyId: string) {
    const order = await this.prisma.onlineOrder.findFirst({
      where: { id, companyId },
    });
    if (!order) throw new NotFoundException('Pedido não encontrado.');
    return order;
  }

  async findByCompany(companyId: string, limit = 50) {
    return this.prisma.onlineOrder.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async updatePayment(
    id: string,
    data: {
      paymentStatus?:
        | 'PENDING'
        | 'APPROVED'
        | 'REJECTED'
        | 'REFUNDED'
        | 'EXPIRED';
      mercadopagoPaymentId?: string;
      mercadopagoPreferenceId?: string;
      pixQrcode?: string;
      pixCopyPaste?: string;
      pixExpiresAt?: Date;
      paidAt?: Date;
    },
  ) {
    const order = await this.prisma.onlineOrder.update({ where: { id }, data });

    // After payment confirmation → emit to kitchen (PIX approved, etc.)
    setImmediate(() => {
      try {
        this.socketGateway.emitOnlineOrderPaid(order.companyId, {
          orderId: id,
          paymentStatus: data.paymentStatus,
        });
      } catch {}
    });

    return order;
  }

  async updateOrderStatus(id: string, orderStatus: string) {
    return this.prisma.onlineOrder.update({
      where: { id },
      data: { orderStatus: orderStatus as any },
    });
  }
}
