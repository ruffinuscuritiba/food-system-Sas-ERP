import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '@/database/prisma.service';
import { OrdersService } from '@/modules/orders/orders.service';

@Injectable()
export class DriversService {
  constructor(
    private prisma: PrismaService,
    private ordersService: OrdersService,
  ) {}

  findAll(companyId: string) {
    return this.prisma.driverProfile.findMany({
      where: { companyId },
      include: { user: { select: { id: true, name: true, email: true, isActive: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: string, companyId: string) {
    return this.prisma.driverProfile.findFirst({
      where: { id, companyId },
      include: {
        user: { select: { id: true, name: true, email: true, isActive: true } },
        orders: {
          where: { status: { in: ['CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'] } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
  }

  async create(companyId: string, data: any) {
    const { name, email, password, phone, vehicleType, vehiclePlate } = data;

    const bcrypt = await import('bcrypt');
    const hashed = await bcrypt.hash(password || 'Entregador@123', 10);

    const user = await this.prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        role: 'DELIVERY',
        isActive: true,
        companyId,
      },
    });

    return this.prisma.driverProfile.create({
      data: {
        userId: user.id,
        phone,
        vehicleType,
        vehiclePlate,
        companyId,
      },
      include: { user: { select: { id: true, name: true, email: true, isActive: true } } },
    });
  }

  async update(id: string, companyId: string, data: any) {
    const profile = await this.prisma.driverProfile.findFirst({ where: { id, companyId } });
    if (!profile) throw new NotFoundException('Entregador não encontrado');

    const { name, isActive, phone, vehicleType, vehiclePlate, isAvailable } = data;

    if (name || isActive !== undefined) {
      await this.prisma.user.update({
        where: { id: profile.userId },
        data: {
          ...(name && { name }),
          ...(isActive !== undefined && { isActive }),
        },
      });
    }

    return this.prisma.driverProfile.update({
      where: { id },
      data: {
        ...(phone !== undefined && { phone }),
        ...(vehicleType !== undefined && { vehicleType }),
        ...(vehiclePlate !== undefined && { vehiclePlate }),
        ...(isAvailable !== undefined && { isAvailable }),
      },
      include: { user: { select: { id: true, name: true, email: true, isActive: true } } },
    });
  }

  async updateLocation(id: string, lat: number, lng: number) {
    return this.prisma.driverProfile.update({
      where: { id },
      data: { currentLat: lat, currentLng: lng },
    });
  }

  async assignOrder(orderId: string, driverId: string, companyId: string, userId: string) {
    const driver = await this.prisma.driverProfile.findFirst({ where: { id: driverId, companyId } });
    if (!driver) throw new NotFoundException('Entregador não encontrado');

    const order = await this.prisma.order.findFirst({ where: { id: orderId, companyId } });
    if (!order) throw new NotFoundException('Pedido não encontrado');

    // Persist driver assignment fields outside the status transaction
    await this.prisma.order.update({
      where: { id: orderId },
      data: { driverId, assignedAt: new Date() },
    });

    // Delegate status transition via OrdersService (stock, socket, loyalty, audit)
    return this.ordersService.updateStatus(orderId, OrderStatus.OUT_FOR_DELIVERY, userId, companyId);
  }

  async myOrders(userId: string) {
    const profile = await this.prisma.driverProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Perfil não encontrado');

    return this.prisma.order.findMany({
      where: {
        driverId: profile.id,
        status: { in: ['OUT_FOR_DELIVERY', 'DELIVERED'] },
      },
      orderBy: { assignedAt: 'desc' },
      take: 20,
      include: { customer: true },
    });
  }

  async myProfile(userId: string) {
    return this.prisma.driverProfile.findUnique({
      where: { userId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  // ── Earnings & Payments ─────────────────────────────────────────────────

  listEarnings(driverProfileId: string, companyId: string) {
    return this.prisma.driverEarning.findMany({
      where: { driverProfileId, companyId },
      orderBy: { createdAt: 'desc' },
      include: {
        order: { select: { id: true, createdAt: true, total: true, deliveryAddress: true } },
      },
    });
  }

  listPayments(driverProfileId: string, companyId: string) {
    return this.prisma.driverPayment.findMany({
      where: { driverProfileId, companyId },
      orderBy: { createdAt: 'desc' },
      include: {
        earnings: { select: { id: true, orderId: true, driverAmount: true, status: true } },
      },
    });
  }

  async myEarnings(userId: string) {
    const profile = await this.prisma.driverProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Perfil não encontrado');
    return this.listEarnings(profile.id, profile.companyId);
  }

  async myPayments(userId: string) {
    const profile = await this.prisma.driverProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Perfil não encontrado');
    return this.listPayments(profile.id, profile.companyId);
  }

  async createPayment(driverProfileId: string, companyId: string) {
    const driver = await this.prisma.driverProfile.findFirst({ where: { id: driverProfileId, companyId } });
    if (!driver) throw new NotFoundException('Entregador não encontrado');

    const earnings = await this.prisma.driverEarning.findMany({
      where: { driverProfileId, companyId, status: 'PENDING', driverPaymentId: null },
    });
    if (!earnings.length) throw new BadRequestException('Nenhum repasse pendente para este entregador');

    const totalAmount = earnings.reduce((sum, e) => sum + Number(e.driverAmount), 0);

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.driverPayment.create({
        data: { companyId, driverProfileId, totalAmount },
      });
      await tx.driverEarning.updateMany({
        where: { id: { in: earnings.map((e) => e.id) } },
        data: { driverPaymentId: payment.id },
      });
      return payment;
    });
  }

  async payPayment(paymentId: string, companyId: string) {
    const payment = await this.prisma.driverPayment.findFirst({
      where: { id: paymentId, companyId },
      include: { driverProfile: { include: { user: { select: { name: true } } } } },
    });
    if (!payment) throw new NotFoundException('Pagamento não encontrado');
    if (payment.status === 'PAID') throw new BadRequestException('Pagamento já quitado');

    return this.prisma.$transaction(async (tx) => {
      const financial = await tx.financial.create({
        data: {
          companyId,
          type: 'EXPENSE',
          category: 'REPASSE_ENTREGADOR',
          description: `Repasse entregador ${payment.driverProfile.user.name ?? payment.driverProfileId}`,
          amount: payment.totalAmount,
        },
      });
      await tx.driverEarning.updateMany({
        where: { driverPaymentId: paymentId },
        data: { status: 'PAID' },
      });
      return tx.driverPayment.update({
        where: { id: paymentId },
        data: { status: 'PAID', paidAt: new Date(), financialId: financial.id },
      });
    });
  }
}
