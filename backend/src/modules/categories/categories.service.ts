import { Injectable, BadRequestException } from '@nestjs/common';

import { PrismaService } from 'src/database/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async create(data: any) {
    const max = await this.prisma.category.aggregate({
      where: { companyId: data.companyId },
      _max: { sortOrder: true },
    });
    const nextSort = (max._max.sortOrder ?? 0) + 1;

    return this.prisma.category.create({
      data: {
        name: data.name,
        allowMultipleFlavors: data.allowMultipleFlavors ?? false,
        categoryType: data.categoryType ?? 'normal',
        displayColumns: data.displayColumns ?? 4,
        sortOrder: nextSort,
        ...(data.bannerImage !== undefined && { bannerImage: data.bannerImage }),
        ...(data.parentCategoryId !== undefined && data.parentCategoryId !== null && {
          parent: { connect: { id: data.parentCategoryId } },
        }),
        company: { connect: { id: data.companyId } },
      },
    });
  }

  findAll(companyId: string) {
    return this.prisma.category.findMany({
      where: { companyId },
      select: {
        id: true,
        name: true,
        categoryType: true,
        displayColumns: true,
        allowMultipleFlavors: true,
        bannerImage: true,
        sortOrder: true,
        companyId: true,
        parentCategoryId: true,
        children: {
          select: {
            id: true,
            name: true,
            categoryType: true,
            displayColumns: true,
            allowMultipleFlavors: true,
            bannerImage: true,
            sortOrder: true,
            companyId: true,
            parentCategoryId: true,
          },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  update(
    id: string,
    companyId: string,
    data: {
      name?: string;
      allowMultipleFlavors?: boolean;
      categoryType?: string;
      displayColumns?: number;
      bannerImage?: string | null;
      parentCategoryId?: string | null;
    },
  ) {
    return this.prisma.category.update({
      where: { id, companyId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.allowMultipleFlavors !== undefined && { allowMultipleFlavors: data.allowMultipleFlavors }),
        ...(data.categoryType !== undefined && { categoryType: data.categoryType }),
        ...(data.displayColumns !== undefined && { displayColumns: data.displayColumns }),
        ...(data.bannerImage !== undefined && { bannerImage: data.bannerImage }),
        ...(data.parentCategoryId !== undefined && {
          parentCategoryId: data.parentCategoryId,
        }),
      },
    });
  }

  async reorder(companyId: string, items: { id: string; sortOrder: number }[]) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('items é obrigatório');
    }

    // Tenant guard: rejeita qualquer id que não pertença à empresa autenticada
    const ids = items.map((i) => i.id);
    const owned = await this.prisma.category.findMany({
      where: { id: { in: ids }, companyId },
      select: { id: true },
    });
    if (owned.length !== ids.length) {
      throw new BadRequestException('Categoria fora da empresa');
    }

    await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.category.update({
          where: { id: item.id, companyId },
          data: { sortOrder: item.sortOrder },
        }),
      ),
    );

    return { ok: true, updated: items.length };
  }

  remove(id: string, companyId: string) {
    return this.prisma.category.delete({
      where: { id, companyId },
    });
  }
}
