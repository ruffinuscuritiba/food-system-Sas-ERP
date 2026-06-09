import { Injectable, BadRequestException } from '@nestjs/common';

import { PrismaService } from '@/database/prisma.service';

import { AuditService } from '@/modules/audit/audit.service';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,

    private auditService: AuditService,
  ) {}

  findAll(companyId: string) {
    return this.prisma.product.findMany({
      where: {
        companyId,
        deletedAt: null,
      },

      include: {
        category: {
          select: {
            id: true,
            name: true,
            categoryType: true,
            sortOrder: true,
            companyId: true,
          },
        },
        sizes: {
          orderBy: { size: 'asc' },
        },
      },

      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async create(data: any) {
    const rawSizes = data.sizes ?? [];
    const sizes: Array<{ size: string; price: number }> =
      typeof rawSizes === 'string' ? JSON.parse(rawSizes) : rawSizes;

    // Próximo sortOrder dentro da empresa (drag-and-drop)
    const maxSort = await this.prisma.product.aggregate({
      where: { companyId: data.companyId },
      _max: { sortOrder: true },
    });
    const nextSort = (maxSort._max.sortOrder ?? 0) + 1;

    const product = await this.prisma.product.create({
      data: {
        name: data.name,

        sortOrder: nextSort,

        description: data.description,

        sku: data.sku,

        barcode: data.barcode,

        unit: data.unit,

        size: data.size,

        weight: parseFloat(data.weight || 0),

        imageUrl: data.imageUrl,

        costPrice: parseFloat(data.costPrice || 0),

        profitMargin: parseFloat(data.profitMargin || 0),

        salePrice: parseFloat(data.salePrice ?? data.price ?? 0),

        isActive: data.isActive ?? true,

        trackStock: data.trackStock ?? true,

        allowNegativeStock: data.allowNegativeStock ?? false,

        videoUrl: data.videoUrl ?? null,

        hasVideo: !!data.videoUrl,

        productType: data.productType ?? 'standard',

        eanCode: data.eanCode ?? null,

        company: {
          connect: {
            id: data.companyId,
          },
        },

        ...(data.categoryId && {
          category: {
            connect: {
              id: data.categoryId,
            },
          },
        }),

        ...(sizes.length > 0 && {
          sizes: {
            create: sizes.map((s) => ({
              size: s.size,
              price: Number(s.price),
              companyId: data.companyId,
            })),
          },
        }),
      },

      include: {
        category: true,
        sizes: { orderBy: { size: 'asc' } },
      },
    });

    await this.auditService.log({
      action: 'CREATE_PRODUCT',

      entity: 'Product',

      entityId: product.id,

      description: `Produto criado: ${product.name}`,

      companyId: data.companyId,

      metadata: {
        name: product.name,

        salePrice: product.salePrice,
      },
    });

    return product;
  }

  async update(id: string, data: any) {
    const rawSizes = data.sizes;
    const sizes: Array<{ size: string; price: number }> | undefined =
      rawSizes === undefined
        ? undefined
        : typeof rawSizes === 'string'
          ? JSON.parse(rawSizes)
          : rawSizes;

    if (sizes !== undefined) {
      await this.prisma.productSize.deleteMany({
        where: { productId: id, companyId: data.companyId },
      });
      if (sizes.length > 0) {
        await this.prisma.productSize.createMany({
          data: sizes.map((s) => ({
            productId: id,
            size: s.size,
            price: Number(s.price),
            companyId: data.companyId ?? '',
          })),
        });
      }
    }

    return this.prisma.product.update({
      where: { id, companyId: data.companyId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
        ...(data.salePrice !== undefined && {
          salePrice: parseFloat(data.salePrice),
        }),
        ...(data.costPrice !== undefined && {
          costPrice: parseFloat(data.costPrice),
        }),
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
        ...(data.videoUrl !== undefined && {
          videoUrl: data.videoUrl || null,
          hasVideo: !!data.videoUrl,
        }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.productType !== undefined && {
          productType: data.productType,
        }),
        ...(data.eanCode !== undefined && { eanCode: data.eanCode }),
        ...(data.categoryId !== undefined &&
          data.categoryId !== '' && {
            category: { connect: { id: data.categoryId } },
          }),
      },
      include: {
        category: true,
        sizes: { orderBy: { size: 'asc' } },
      },
    });
  }

  async publicMenu(companyId: string) {
    return this.prisma.product.findMany({
      where: {
        companyId,

        isActive: true,

        deletedAt: null,
      },

      include: {
        category: true,
        sizes: { orderBy: { size: 'asc' } },
      },

      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async reorder(companyId: string, items: { id: string; sortOrder: number }[]) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('items é obrigatório');
    }

    // Tenant guard: rejeita qualquer id que não pertença à empresa
    const ids = items.map((i) => i.id);
    const owned = await this.prisma.product.findMany({
      where: { id: { in: ids }, companyId, deletedAt: null },
      select: { id: true },
    });
    if (owned.length !== ids.length) {
      throw new BadRequestException('Produto fora da empresa');
    }

    await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.product.update({
          where: { id: item.id, companyId },
          data: { sortOrder: item.sortOrder },
        }),
      ),
    );

    return { ok: true, updated: items.length };
  }

  findTrash(companyId: string) {
    return this.prisma.product.findMany({
      where: {
        companyId,

        deletedAt: {
          not: null,
        },
      },

      include: {
        category: true,
      },

      orderBy: {
        deletedAt: 'desc',
      },
    });
  }

  async restore(id: string, companyId: string) {
    const product = await this.prisma.product.update({
      where: {
        id,
        companyId,
      },

      data: {
        deletedAt: null,

        isActive: true,
      },
    });

    await this.auditService.log({
      action: 'RESTORE_PRODUCT',

      entity: 'Product',

      entityId: product.id,

      description: `Produto restaurado: ${product.name}`,

      companyId: product.companyId,

      metadata: {
        name: product.name,
      },
    });

    return product;
  }
  async remove(id: string, companyId: string) {
    const product = await this.prisma.product.update({
      where: {
        id,
        companyId,
      },

      data: {
        deletedAt: new Date(),

        isActive: false,
      },
    });

    await this.auditService.log({
      action: 'DELETE_PRODUCT',

      entity: 'Product',

      entityId: product.id,

      description: `Produto removido: ${product.name}`,

      companyId: product.companyId,

      metadata: {
        name: product.name,
      },
    });

    return product;
  }
}
