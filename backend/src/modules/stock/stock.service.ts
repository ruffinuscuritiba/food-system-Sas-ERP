import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';

import { Prisma, StockMovementType } from '@prisma/client';

interface ConsumeIngredientPayload {
  ingredientId: string;
  quantity: number;
  companyId: string;
  performedById: string;
  reason?: string;
  referenceId?: string;
  referenceType?: string;
}

@Injectable()
export class StockService {
  constructor(private prisma: PrismaService) {}

  async consumeIngredientTransactional(
    tx: Prisma.TransactionClient,

    payload: ConsumeIngredientPayload,
  ) {
    const ingredient = await tx.ingredient.findFirst({
      where: {
        id: payload.ingredientId,

        companyId: payload.companyId,
      },
    });

    if (!ingredient) {
      throw new NotFoundException('Ingrediente não encontrado');
    }

    const currentStock = Number(ingredient.stock);

    const quantity = Number(payload.quantity);

    const newStock = currentStock - quantity;

    if (newStock < 0 && !ingredient.allowNegativeStock) {
      throw new BadRequestException(
        `Estoque insuficiente para ${ingredient.name}`,
      );
    }

    await tx.ingredient.update({
      where: {
        id: ingredient.id,
      },

      data: {
        stock: newStock,
      },
    });

    await tx.stockMovement.create({
      data: {
        ingredientId: ingredient.id,

        companyId: payload.companyId,

        type: StockMovementType.SALE,

        quantity,

        previousStock: currentStock,

        currentStock: newStock,

        unitCost: ingredient.averageCost,

        totalCost: Number(ingredient.averageCost) * quantity,

        reason: payload.reason,

        referenceId: payload.referenceId,

        referenceType: payload.referenceType,

        performedById: payload.performedById,

        metadata: {
          source: 'automatic-order-consumption',
        },
      },
    });

    return {
      previousStock: currentStock,

      currentStock: newStock,
    };
  }

  async restoreIngredientTransactional(
    tx: Prisma.TransactionClient,

    payload: ConsumeIngredientPayload,
  ) {
    const ingredient = await tx.ingredient.findFirst({
      where: {
        id: payload.ingredientId,

        companyId: payload.companyId,
      },
    });

    if (!ingredient) {
      throw new NotFoundException('Ingrediente não encontrado');
    }

    const currentStock = Number(ingredient.stock);

    const quantity = Number(payload.quantity);

    const newStock = currentStock + quantity;

    await tx.ingredient.update({
      where: {
        id: ingredient.id,
      },

      data: {
        stock: newStock,
      },
    });

    await tx.stockMovement.create({
      data: {
        ingredientId: ingredient.id,

        companyId: payload.companyId,

        type: StockMovementType.RETURN,

        quantity,

        previousStock: currentStock,

        currentStock: newStock,

        unitCost: ingredient.averageCost,

        totalCost: Number(ingredient.averageCost) * quantity,

        reason: payload.reason,

        referenceId: payload.referenceId,

        referenceType: payload.referenceType,

        performedById: payload.performedById,

        metadata: {
          source: 'cancelled-order-rollback',
        },
      },
    });

    return {
      previousStock: currentStock,

      currentStock: newStock,
    };
  }

  async createMovement(data: {
    ingredientId: string;
    companyId: string;
    type: StockMovementType;
    quantity: number;
    reason?: string;
  }) {
    const ingredient = await this.prisma.ingredient.findUnique({
      where: {
        id: data.ingredientId,
      },
    });

    if (!ingredient) {
      throw new NotFoundException('Ingrediente não encontrado');
    }

    const previousStock = Number(ingredient.stock);

    let currentStock = Number(previousStock);

    switch (data.type) {
      case StockMovementType.ENTRY:
        currentStock += Number(data.quantity);

        break;

      case StockMovementType.EXIT:

      case StockMovementType.LOSS:

      case StockMovementType.SALE:
        currentStock -= Number(data.quantity);

        if (currentStock < 0 && !ingredient.allowNegativeStock) {
          throw new BadRequestException(
            `Estoque insuficiente para ${ingredient.name}`,
          );
        }

        break;

      case StockMovementType.RETURN:
        currentStock += Number(data.quantity);

        break;

      case StockMovementType.INVENTORY:

      case StockMovementType.ADJUSTMENT:
        currentStock = Number(data.quantity);

        break;
    }

    await this.prisma.ingredient.update({
      where: {
        id: ingredient.id,
      },

      data: {
        stock: currentStock,
      },
    });

    return this.prisma.stockMovement.create({
      data: {
        ingredient: {
          connect: {
            id: ingredient.id,
          },
        },

        company: {
          connect: {
            id: data.companyId,
          },
        },

        type: data.type,

        quantity: Number(data.quantity),

        previousStock: Number(previousStock),

        currentStock: Number(currentStock),

        unitCost: ingredient.averageCost,

        totalCost: Number(ingredient.averageCost) * Number(data.quantity),

        reason: data.reason,

        metadata: {
          source: 'manual-stock-movement',
        },
      },
    });
  }

  async consumeIngredient(
    ingredientId: string,
    quantity: number,
    companyId: string,
  ) {
    return this.createMovement({
      ingredientId,

      quantity,

      companyId,

      type: StockMovementType.EXIT,

      reason: 'Consumo automático pedido',
    });
  }

  async addStock(ingredientId: string, quantity: number, companyId: string) {
    return this.createMovement({
      ingredientId,

      quantity,

      companyId,

      type: StockMovementType.ENTRY,

      reason: 'Entrada estoque',
    });
  }

  async getLowStock(companyId: string) {
    const ingredients = await this.prisma.ingredient.findMany({
      where: {
        companyId,
      },
    });

    return ingredients.filter(
      (ingredient) =>
        Number(ingredient.stock) <= Number(ingredient.minimumStock),
    );
  }

  async dashboard(companyId: string) {
    const ingredients = await this.prisma.ingredient.findMany({
      where: {
        companyId,
      },
    });

    const lowStock = ingredients.filter(
      (ingredient) =>
        Number(ingredient.stock) <= Number(ingredient.minimumStock),
    );

    const movements = await this.prisma.stockMovement.findMany({
      where: {
        companyId,
      },
    });

    let totalStockValue = 0;

    for (const ingredient of ingredients) {
      totalStockValue +=
        Number(ingredient.stock) *
        Number(ingredient.averageCost || ingredient.cost);
    }

    const entries = movements.filter(
      (movement) => movement.type === StockMovementType.ENTRY,
    ).length;

    const exits = movements.filter(
      (movement) =>
        movement.type === StockMovementType.EXIT ||
        movement.type === StockMovementType.SALE,
    ).length;

    const losses = movements.filter(
      (movement) => movement.type === StockMovementType.LOSS,
    ).length;

    return {
      totalIngredients: ingredients.length,

      lowStockCount: lowStock.length,

      totalMovements: movements.length,

      entries,

      exits,

      losses,

      totalStockValue,
    };
  }

  async getMovements(
    companyId: string,
    filters?: { from?: string; to?: string; type?: string },
  ) {
    const where: Prisma.StockMovementWhereInput = { companyId };

    if (filters?.type) {
      where.type = filters.type as StockMovementType;
    }

    if (filters?.from || filters?.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = new Date(filters.from);
      if (filters.to) {
        const end = new Date(filters.to);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    return this.prisma.stockMovement.findMany({
      where,

      include: {
        ingredient: true,
      },

      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
