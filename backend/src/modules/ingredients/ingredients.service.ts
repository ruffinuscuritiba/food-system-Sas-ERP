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
}