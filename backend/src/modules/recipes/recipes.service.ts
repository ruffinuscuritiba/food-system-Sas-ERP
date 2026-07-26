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

  // FIX: antes esse método só criava (`prisma.recipe.create`), o que quebrava
  // com erro de "unique constraint" se o produto já tivesse uma receita
  // (Recipe.productId é @unique no schema). Agora ele verifica se já existe
  // uma receita para o produto: se existir, apaga os itens antigos e recria
  // com os novos (efetivamente uma edição); se não existir, cria do zero.
  // O nome do método continua "create" para não precisar mudar a rota no
  // controller nem o endpoint que o frontend já chama.
  async create(data: any) {
    const existing = await this.prisma.recipe.findFirst({
      where: { productId: data.productId, companyId: data.companyId },
    });

    if (existing) {
      // Remove os itens antigos da receita antes de recriar com a lista nova
      await this.prisma.recipeItem.deleteMany({
        where: { recipeId: existing.id },
      });

      return this.prisma.recipe.update({
        where: { id: existing.id },
        data: {
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
