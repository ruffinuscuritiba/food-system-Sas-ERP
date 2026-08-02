import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';

// Mesma normalização (acento/case-insensitive, exata — nunca substring
// parcial) já usada no dedupe do Smart Import (smart-import.service.ts) —
// reaproveitada aqui pro cadastro manual, que até agora não tinha NENHUMA
// checagem de duplicata (causa real de "File De Peito Frango" aparecer 2x
// com estoque/custo diferentes em vez de somar).
const DIACRITICS_RE = new RegExp('[\\u0300-\\u036f]', 'g');
function normalizeIngredientName(s: string): string {
  return s
    .normalize('NFD')
    .replace(DIACRITICS_RE, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

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
    const normalizedName = normalizeIngredientName(String(data.name ?? ''));
    const newStock = Number(data.stock) || 0;

    const [existing, aliasMatch] = await Promise.all([
      this.prisma.ingredient.findMany({
        where: { companyId: data.companyId },
        select: { id: true, name: true, stock: true, cost: true },
      }),
      this.prisma.ingredientAlias.findFirst({
        where: { companyId: data.companyId, alias: { equals: data.name, mode: 'insensitive' } },
        select: { ingredientId: true },
      }),
    ]);
    const exactMatch = existing.find(
      (i) => normalizeIngredientName(i.name) === normalizedName,
    );
    const matchedId = exactMatch?.id ?? aliasMatch?.ingredientId;

    if (matchedId) {
      // Mesmo ingrediente já cadastrado (nome idêntico ou apelido conhecido)
      // — soma ao estoque existente em vez de criar uma 2ª linha duplicada,
      // com StockMovement de auditoria, igual ao fluxo de nota fiscal.
      return this.prisma.$transaction(async (tx) => {
        const current = await tx.ingredient.findFirst({
          where: { id: matchedId, companyId: data.companyId },
        });
        if (!current) throw new NotFoundException('Ingrediente não encontrado');

        const previousStock = Number(current.stock);
        const currentStock = previousStock + newStock;
        const unitCost = Number(data.cost) || Number(current.cost);

        const updated = await tx.ingredient.update({
          where: { id: matchedId },
          data: { stock: currentStock, isActive: true, deletedAt: null },
        });

        if (newStock !== 0) {
          await tx.stockMovement.create({
            data: {
              ingredient: { connect: { id: matchedId } },
              company: { connect: { id: data.companyId } },
              type: 'ENTRY',
              quantity: newStock,
              previousStock,
              currentStock,
              unitCost,
              totalCost: newStock * unitCost,
              reason: 'Entrada via cadastro (ingrediente já existente — somado ao estoque)',
            },
          });
        }

        return { ...updated, mergedIntoExisting: true };
      });
    }

    return this.prisma.ingredient.create({
      data: {
        name: data.name,

        stock: newStock,

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

  async listAliases(companyId: string) {
    return this.prisma.ingredientAlias.findMany({
      where: { companyId },
      select: { id: true, alias: true, ingredientId: true },
    });
  }
}
