import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class IngredientsService {
  constructor(private prisma: PrismaService) {}

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

        minimumStock: Number(data.minimumStock || 0),

        unit: data.unit,

        cost: Number(data.cost),

        companyId: data.companyId,
      },
    });
  }

  async update(id: string, companyId: string, data: any) {
    const patch: any = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.stock !== undefined) patch.stock = Number(data.stock);
    if (data.minimumStock !== undefined)
      patch.minimumStock = Number(data.minimumStock);
    if (data.unit !== undefined) patch.unit = data.unit;
    if (data.cost !== undefined) patch.cost = Number(data.cost);
    if (data.isActive !== undefined) patch.isActive = Boolean(data.isActive);

    // Edição direta do campo estoque não tinha rastro em StockMovement —
    // qualquer alteração de stock aqui vira um ADJUSTMENT auditável.
    if (patch.stock === undefined) {
      return this.prisma.ingredient.update({
        where: { id, companyId },
        data: patch,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.ingredient.findFirst({
        where: { id, companyId },
      });
      if (!current) throw new NotFoundException('Ingrediente não encontrado');

      const previousStock = Number(current.stock);
      const newStock = patch.stock;

      const updated = await tx.ingredient.update({
        where: { id, companyId },
        data: patch,
      });

      if (newStock !== previousStock) {
        const diff = Math.abs(newStock - previousStock);
        const unitCost = Number(current.cost);
        await tx.stockMovement.create({
          data: {
            ingredient: { connect: { id } },
            company: { connect: { id: companyId } },
            type: 'ADJUSTMENT',
            quantity: diff,
            previousStock,
            currentStock: newStock,
            unitCost,
            totalCost: diff * unitCost,
            reason: 'Ajuste manual de estoque (edição de ingrediente)',
          },
        });
      }

      return updated;
    });
  }

  async remove(id: string, companyId: string) {
    return this.prisma.ingredient.update({
      where: { id, companyId },
      data: { deletedAt: new Date() },
    });
  }
}
