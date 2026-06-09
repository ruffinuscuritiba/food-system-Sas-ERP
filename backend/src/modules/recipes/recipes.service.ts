import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class RecipesService {
  constructor(private prisma: PrismaService) {}

  async findByProduct(productId: string, companyId: string) {
    return this.prisma.recipe.findFirst({
      where: {
        productId,
        companyId,
      },

      include: {
        product: true,

        items: {
          include: {
            ingredient: true,
          },
        },
      },
    });
  }

  async create(data: any) {
    return this.prisma.recipe.create({
      data: {
        product: {
          connect: {
            id: data.productId,
          },
        },

        company: {
          connect: {
            id: data.companyId,
          },
        },

        items: {
          create: data.items.map((item: any) => ({
            ingredient: {
              connect: {
                id: item.ingredientId,
              },
            },

            quantity: Number(item.quantity),
          })),
        },
      },

      include: {
        product: true,

        items: {
          include: {
            ingredient: true,
          },
        },
      },
    });
  }
}
