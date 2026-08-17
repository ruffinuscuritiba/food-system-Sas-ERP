import { Injectable, BadRequestException } from '@nestjs/common';

import { PrismaService } from 'src/database/prisma.service';

import { MenuCacheService } from '@/common/services/menu-cache.service';

@Injectable()
export class CategoriesService {
  constructor(
    private prisma: PrismaService,
    private menuCache: MenuCacheService,
  ) {}

  async create(data: any) {
    const max = await this.prisma.category.aggregate({
      where: { companyId: data.companyId },
      _max: { sortOrder: true },
    });
    const nextSort = (max._max.sortOrder ?? 0) + 1;

    const category = await this.prisma.category.create({
      data: {
        name: data.name,
        allowMultipleFlavors: data.allowMultipleFlavors ?? false,
        categoryType: data.categoryType ?? 'normal',
        displayColumns: data.displayColumns ?? 4,
        sortOrder: nextSort,
        ...(data.bannerImage !== undefined && { bannerImage: data.bannerImage }),
        ...(data.bannerImageZoom !== undefined && { bannerImageZoom: data.bannerImageZoom }),
        ...(data.parentCategoryId !== undefined && data.parentCategoryId !== null && {
          parent: { connect: { id: data.parentCategoryId } },
        }),
        ...(data.availableFrom !== undefined && { availableFrom: data.availableFrom || null }),
        ...(data.availableTo !== undefined && { availableTo: data.availableTo || null }),
        ...(data.availableDays !== undefined && { availableDays: data.availableDays || null }),
        company: { connect: { id: data.companyId } },
      },
    });

    this.menuCache.invalidate(data.companyId);
    return category;
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
        bannerImageZoom: true,
        sortOrder: true,
        companyId: true,
        parentCategoryId: true,
        availableFrom: true,
        availableTo: true,
        availableDays: true,
        children: {
          select: {
            id: true,
            name: true,
            categoryType: true,
            displayColumns: true,
            allowMultipleFlavors: true,
            bannerImage: true,
            bannerImageZoom: true,
            sortOrder: true,
            companyId: true,
            parentCategoryId: true,
            availableFrom: true,
            availableTo: true,
            availableDays: true,
          },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async update(
    id: string,
    companyId: string,
    data: {
      name?: string;
      allowMultipleFlavors?: boolean;
      categoryType?: string;
      displayColumns?: number;
      bannerImage?: string | null;
      bannerImageZoom?: number;
      parentCategoryId?: string | null;
      availableFrom?: string | null;
      availableTo?: string | null;
      availableDays?: string | null;
    },
  ) {
    const category = await this.prisma.category.update({
      where: { id, companyId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.allowMultipleFlavors !== undefined && { allowMultipleFlavors: data.allowMultipleFlavors }),
        ...(data.categoryType !== undefined && { categoryType: data.categoryType }),
        ...(data.displayColumns !== undefined && { displayColumns: data.displayColumns }),
        ...(data.bannerImage !== undefined && { bannerImage: data.bannerImage }),
        ...(data.bannerImageZoom !== undefined && { bannerImageZoom: data.bannerImageZoom }),
        ...(data.parentCategoryId !== undefined && {
          parentCategoryId: data.parentCategoryId,
        }),
        ...(data.availableFrom !== undefined && { availableFrom: data.availableFrom || null }),
        ...(data.availableTo !== undefined && { availableTo: data.availableTo || null }),
        ...(data.availableDays !== undefined && { availableDays: data.availableDays || null }),
      },
    });

    this.menuCache.invalidate(companyId);
    return category;
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

    this.menuCache.invalidate(companyId);
    return { ok: true, updated: items.length };
  }

  async remove(id: string, companyId: string) {
    const category = await this.prisma.category.delete({
      where: { id, companyId },
    });

    this.menuCache.invalidate(companyId);
    return category;
  }
}
