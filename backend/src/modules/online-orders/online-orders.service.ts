import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { SocketGateway } from '@/socket/socket.gateway';

const ORDER_TYPES = ['DELIVERY', 'DINE_IN', 'PICKUP'] as const;
const PAYMENT_METHODS = ['PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH'] as const;

type OnlineOrderType = typeof ORDER_TYPES[number];
type OnlinePaymentMethodType = typeof PAYMENT_METHODS[number];

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
    if (company.isBlocked) throw new BadRequestException('Empresa não está aceitando pedidos.');
    if (!dto.items?.length) throw new BadRequestException('Pedido sem itens.');

    const subtotal = Number(dto.subtotal);
    const deliveryFee = Number(dto.deliveryFee ?? 0);
    const discount = Number(dto.discount ?? 0);
    const total = Number(dto.total);
    const orderType = ORDER_TYPES.includes(dto.orderType)
      ? dto.orderType
      : 'DELIVERY';
    const paymentMethod = PAYMENT_METHODS.includes(dto.paymentMethod)
      ? dto.paymentMethod
      : 'PIX';

    if (!isFinite(total) || total <= 0) {
      throw new BadRequestException('Valor total inválido.');
    }

    // ── 2. Persist to database ─────────────────────────────────────────────
    // This is the ONLY source of truth. Events fire only after this resolves.
    const order = await this.prisma.onlineOrder.create({
      data: {
        companyId:     dto.companyId,
        customerName:  dto.customerName.trim(),
        customerPhone: dto.customerPhone.trim(),
        customerEmail: dto.customerEmail?.trim() || null,
        orderType,
        address:       dto.address?.trim() || null,
        addressNumber: dto.addressNumber?.trim() || null,
        neighborhood:  dto.neighborhood?.trim() || null,
        city:          dto.city?.trim() || null,
        state:         dto.state?.trim() || null,
        zipcode:       dto.zipcode?.trim() || null,
        complement:    dto.complement?.trim() || null,
        items:         dto.items as any,
        subtotal,
        deliveryFee,
        discount,
        total,
        paymentMethod,
        notes:         dto.notes?.trim() || null,
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
      } catch (err: any) {
        // Socket failure must never affect the already-created order
        this.logger.warn(`[OnlineOrder] socket emit failed: ${err?.message}`);
      }
    });

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
      paymentStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REFUNDED' | 'EXPIRED';
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
