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
        clientFee: Number(data.clientFee ?? 0),
        driverShare: Number(data.driverShare ?? 0),
        radiusKm: data.radiusKm ? Number(data.radiusKm) : null,
        lat: data.lat ? Number(data.lat) : null,
        lng: data.lng ? Number(data.lng) : null,
        color: data.color ?? '#f97316',
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
        ...(data.neighborhood !== undefined && { neighborhood: data.neighborhood }),
        ...(data.baseFee !== undefined && { baseFee: Number(data.baseFee) }),
        ...(data.pricePerKm !== undefined && { pricePerKm: Number(data.pricePerKm) }),
        ...(data.clientFee !== undefined && { clientFee: Number(data.clientFee) }),
        ...(data.driverShare !== undefined && { driverShare: Number(data.driverShare) }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.radiusKm !== undefined && { radiusKm: data.radiusKm ? Number(data.radiusKm) : null }),
        ...(data.lat !== undefined && { lat: data.lat ? Number(data.lat) : null }),
        ...(data.lng !== undefined && { lng: data.lng ? Number(data.lng) : null }),
        ...(data.color !== undefined && { color: data.color }),
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
  async findAllPublic(slugOrId: string) {
    const company = await this.prisma.company.findFirst({
      where: { OR: [{ id: slugOrId }, { slug: slugOrId }] },
      select: { id: true },
    });
    if (!company) return [];
    const companyId = company.id;
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
