import { Injectable, NotFoundException } from '@nestjs/common';
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
}
