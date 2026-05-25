import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';

export interface CreateOnlineOrderDto {
  companyId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  orderType: 'DELIVERY' | 'DINE_IN' | 'PICKUP';
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
  paymentMethod: 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CASH';
  notes?: string;
}

@Injectable()
export class OnlineOrdersService {
  private readonly logger = new Logger(OnlineOrdersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateOnlineOrderDto) {
    const company = await this.prisma.company.findUnique({
      where: { id: dto.companyId },
      select: { id: true, isBlocked: true },
    });

    if (!company) throw new NotFoundException('Empresa não encontrada.');
    if (company.isBlocked) throw new BadRequestException('Empresa não está aceitando pedidos.');

    if (!dto.items?.length) throw new BadRequestException('Pedido sem itens.');

    const subtotal = Number(dto.subtotal);
    const deliveryFee = Number(dto.deliveryFee ?? 0);
    const discount = Number(dto.discount ?? 0);
    const total = Number(dto.total);

    if (total <= 0) throw new BadRequestException('Valor total inválido.');

    const order = await this.prisma.onlineOrder.create({
      data: {
        companyId:     dto.companyId,
        customerName:  dto.customerName.trim(),
        customerPhone: dto.customerPhone.trim(),
        customerEmail: dto.customerEmail?.trim() || null,
        orderType:     dto.orderType,
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
        paymentMethod: dto.paymentMethod,
        notes:         dto.notes?.trim() || null,
      },
    });

    this.logger.log(`OnlineOrder created: ${order.id} company=${dto.companyId} total=${total}`);
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
    return this.prisma.onlineOrder.update({ where: { id }, data });
  }

  async updateOrderStatus(id: string, orderStatus: string) {
    return this.prisma.onlineOrder.update({
      where: { id },
      data: { orderStatus: orderStatus as any },
    });
  }
}
