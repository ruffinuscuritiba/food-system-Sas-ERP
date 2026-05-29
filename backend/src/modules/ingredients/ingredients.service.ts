import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class IngredientsService {

  constructor(
    private prisma: PrismaService,
  ) {}

  async findAll(companyId: string) {

    return this.prisma.ingredient.findMany({

      where: {
        companyId,
      },

      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async create(data: any) {

    return this.prisma.ingredient.create({

      data: {

        name: data.name,

        stock: Number(data.stock),

        minimumStock:
          Number(data.minimumStock || 0),

        unit: data.unit,

        cost: Number(data.cost),

        companyId:
          data.companyId,
      },
    });
  }

  async update(id: string, companyId: string, data: any) {
    const patch: any = {};
    if (data.name       !== undefined) patch.name          = data.name;
    if (data.stock      !== undefined) patch.stock         = Number(data.stock);
    if (data.minimumStock !== undefined) patch.minimumStock = Number(data.minimumStock);
    if (data.unit       !== undefined) patch.unit          = data.unit;
    if (data.cost       !== undefined) patch.cost          = Number(data.cost);
    if (data.isActive   !== undefined) patch.isActive      = Boolean(data.isActive);
    return this.prisma.ingredient.update({ where: { id, companyId }, data: patch });
  }

  async remove(id: string, companyId: string) {
    return this.prisma.ingredient.update({
      where: { id, companyId },
      data: { deletedAt: new Date() },
    });
  }
}