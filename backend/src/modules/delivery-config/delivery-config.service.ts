import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';

@Injectable()
export class DeliveryConfigService {
  constructor(private prisma: PrismaService) {}

  findAll(companyId: string) {
    return this.prisma.deliveryZone.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });
  }

  async create(companyId: string, data: any) {
    return this.prisma.deliveryZone.create({
      data: {
        companyId,
        name: data.name,
        type: data.type ?? 'NEIGHBORHOOD',
        neighborhood: data.neighborhood ?? null,
        baseFee: data.baseFee ? Number(data.baseFee) : null,
        pricePerKm: data.pricePerKm ? Number(data.pricePerKm) : null,
        clientFee: Number(data.clientFee),
        driverShare: Number(data.driverShare),
      },
    });
  }

  async update(id: string, companyId: string, data: any) {
    const zone = await this.prisma.deliveryZone.findFirst({
      where: { id, companyId },
    });
    if (!zone) throw new NotFoundException('Zona não encontrada');

    return this.prisma.deliveryZone.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.neighborhood !== undefined && {
          neighborhood: data.neighborhood,
        }),
        ...(data.baseFee !== undefined && { baseFee: Number(data.baseFee) }),
        ...(data.pricePerKm !== undefined && {
          pricePerKm: Number(data.pricePerKm),
        }),
        ...(data.clientFee !== undefined && {
          clientFee: Number(data.clientFee),
        }),
        ...(data.driverShare !== undefined && {
          driverShare: Number(data.driverShare),
        }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  }

  async remove(id: string, companyId: string) {
    const zone = await this.prisma.deliveryZone.findFirst({
      where: { id, companyId },
    });
    if (!zone) throw new NotFoundException('Zona não encontrada');
    return this.prisma.deliveryZone.delete({ where: { id } });
  }

  // Returns public zone list (no driverShare) — safe to expose without auth
  findAllPublic(companyId: string) {
    return this.prisma.deliveryZone.findMany({
      where: { companyId, isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        neighborhood: true,
        clientFee: true,
        type: true,
      },
    });
  }

  // Returns the fee for a given neighborhood (for use in order creation)
  async getFeeForNeighborhood(companyId: string, neighborhood: string) {
    const zone = await this.prisma.deliveryZone.findFirst({
      where: {
        companyId,
        isActive: true,
        type: 'NEIGHBORHOOD',
        neighborhood: { equals: neighborhood, mode: 'insensitive' },
      },
    });
    return zone ?? null;
  }
}
