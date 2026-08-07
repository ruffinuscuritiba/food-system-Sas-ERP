import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { PrismaService } from '@/database/prisma.service';

import { AuditService } from '@/modules/audit/audit.service';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,

    private auditService: AuditService,

    private config: ConfigService,
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

        imageZoom: data.imageZoom !== undefined ? Number(data.imageZoom) : 100,

        costPrice: parseFloat(data.costPrice || 0),

        profitMargin: parseFloat(data.profitMargin || 0),

        salePrice: parseFloat(data.salePrice ?? data.price ?? 0),

        originalPrice:
          data.originalPrice !== undefined && data.originalPrice !== ''
            ? parseFloat(data.originalPrice)
            : null,

        featuredLabel: data.featuredLabel || null,

        isFeatured: !!data.featuredLabel,

        maxFlavors:
          data.maxFlavors !== undefined && data.maxFlavors !== ''
            ? parseInt(data.maxFlavors, 10)
            : null,

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
        ...(data.originalPrice !== undefined && {
          originalPrice:
            data.originalPrice === '' || data.originalPrice === null
              ? null
              : parseFloat(data.originalPrice),
        }),
        ...(data.featuredLabel !== undefined && {
          featuredLabel: data.featuredLabel || null,
          isFeatured: !!data.featuredLabel,
        }),
        ...(data.maxFlavors !== undefined && {
          maxFlavors:
            data.maxFlavors === '' || data.maxFlavors === null
              ? null
              : parseInt(data.maxFlavors, 10),
        }),
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
        ...(data.imageZoom !== undefined && { imageZoom: Number(data.imageZoom) }),
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

  async publicMenu(slugOrId: string) {
    const company = await this.prisma.company.findFirst({
      where: { OR: [{ id: slugOrId }, { slug: slugOrId }] },
      select: { id: true },
    });
    if (!company) return [];
    const companyId = company.id;
    const products = await this.prisma.product.findMany({
      where: {
        companyId,

        isActive: true,

        deletedAt: null,
      },

      include: {
        // Select enxuto: bannerImage/bannerImageZoom são base64 grandes e
        // ficam duplicados em todo produto da mesma categoria — não usados
        // pelo cardápio digital (inflavam o payload em vários MB).
        category: {
          select: {
            id: true,
            name: true,
            categoryType: true,
            displayColumns: true,
            allowMultipleFlavors: true,
            sortOrder: true,
            parentCategoryId: true,
          },
        },
        sizes: { orderBy: { size: 'asc' } },
      },

      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    // Produtos com foto salva como base64 direto no banco (sem Cloudinary
    // configurado, ver StorageService) inflavam essa resposta em vários MB —
    // com 42 produtos chegava a 9MB e travava o carregamento do cardápio em
    // celular. Troca a string base64 gigante por uma URL leve que serve a
    // MESMA imagem sob demanda (um <img> por vez, em paralelo, com cache do
    // navegador) em vez de embutir tudo de uma vez no JSON do cardápio.
    const backendUrl = (
      this.config.get<string>('BACKEND_URL') ||
      'https://api.srv1747711.hstgr.cloud'
    ).replace(/\/$/, '');
    return products.map((p) => {
      if (p.imageUrl && p.imageUrl.startsWith('data:')) {
        return {
          ...p,
          imageUrl: `${backendUrl}/api/products/public/image/${p.id}?v=${p.updatedAt.getTime()}`,
        };
      }
      return p;
    });
  }

  /**
   * "Quem pediu isso também pediu" — coocorrência real de pedidos, sem IA
   * nenhuma: conta, entre os pedidos dos últimos 180 dias que continham
   * `productId`, quais OUTROS produtos apareceram no mesmo pedido, e devolve
   * os mais frequentes. Público (cardápio digital chama sem login) porque
   * não expõe nada sensível — só contagem agregada, sem nome/telefone de
   * cliente.
   *
   * Une Order (PDV/mesa/WhatsApp, tem OrderItem relacional) + OnlineOrder
   * (cardápio digital/totem, `items` é JSON solto) — mesmo motivo de
   * ReportsService.getRevenue: o canal mais comum (cardápio digital) ficaria
   * de fora se só olhasse Order, e a recomendação pareceria sempre vazia ou
   * genérica pras lojas que vendem majoritariamente pelo link do cardápio.
   */
  async getFrequentlyBoughtWith(
    slugOrId: string,
    productId: string,
    limit = 4,
  ) {
    const company = await this.prisma.company.findFirst({
      where: { OR: [{ id: slugOrId }, { slug: slugOrId }] },
      select: { id: true },
    });
    if (!company) return [];
    const companyId = company.id;

    const since = new Date();
    since.setDate(since.getDate() - 180);

    const counts = new Map<string, number>();
    const bump = (id: string) => counts.set(id, (counts.get(id) ?? 0) + 1);

    // ── Order (PDV/mesa/WhatsApp) ────────────────────────────────────────
    const orders = await this.prisma.order.findMany({
      where: {
        companyId,
        status: { not: 'CANCELLED' },
        createdAt: { gte: since },
        items: { some: { productId } },
      },
      select: { items: { select: { productId: true } } },
      take: 500,
    });
    for (const order of orders) {
      for (const item of order.items) {
        if (item.productId !== productId) bump(item.productId);
      }
    }

    // ── OnlineOrder (cardápio digital/totem) ─────────────────────────────
    const onlineOrders = await this.prisma.onlineOrder.findMany({
      where: {
        companyId,
        orderStatus: { not: 'CANCELED' },
        createdAt: { gte: since },
      },
      select: { items: true },
      take: 500,
    });
    for (const order of onlineOrders) {
      const items = Array.isArray(order.items) ? (order.items as any[]) : [];
      const hasTarget = items.some((it) => it?.productId === productId);
      if (!hasTarget) continue;
      for (const it of items) {
        if (it?.productId && it.productId !== productId) bump(it.productId);
      }
    }

    if (counts.size === 0) return [];

    const topIds = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id);

    const products = await this.prisma.product.findMany({
      where: { id: { in: topIds }, companyId, isActive: true, deletedAt: null },
      select: { id: true, name: true, salePrice: true, imageUrl: true },
    });

    // Reordena pela contagem (findMany não garante a ordem de `in`).
    const byId = new Map(products.map((p) => [p.id, p]));
    return topIds.map((id) => byId.get(id)).filter(Boolean);
  }

  async getPublicImage(id: string): Promise<{ mime: string; buffer: Buffer }> {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      select: { imageUrl: true },
    });
    const dataUrl = product?.imageUrl;
    if (!dataUrl || !dataUrl.startsWith('data:')) {
      throw new NotFoundException('Imagem não encontrada');
    }
    const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
    if (!match) {
      throw new NotFoundException('Imagem não encontrada');
    }
    return { mime: match[1], buffer: Buffer.from(match[2], 'base64') };
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
