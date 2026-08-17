import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { PrismaService } from '@/database/prisma.service';

import { AuditService } from '@/modules/audit/audit.service';

import { getStartOfTodayBrazil, isWithinTimeWindow } from '@/common/utils/timezone';

import { MenuCacheService } from '@/common/services/menu-cache.service';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,

    private auditService: AuditService,

    private config: ConfigService,

    private menuCache: MenuCacheService,
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
    const sizes: Array<{ size: string; price: number; originalPrice?: number | null }> =
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

        promoStartTime: data.promoStartTime || null,

        promoEndTime: data.promoEndTime || null,

        promoDays: data.promoDays || null,

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
              originalPrice:
                s.originalPrice != null && Number(s.originalPrice) > 0
                  ? Number(s.originalPrice)
                  : null,
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

    this.menuCache.invalidate(data.companyId);
    return product;
  }

  async update(id: string, data: any) {
    const rawSizes = data.sizes;
    const sizes:
      | Array<{ size: string; price: number; originalPrice?: number | null }>
      | undefined =
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
            originalPrice:
              s.originalPrice != null && Number(s.originalPrice) > 0
                ? Number(s.originalPrice)
                : null,
            companyId: data.companyId ?? '',
          })),
        });
      }
    }

    const updated = await this.prisma.product.update({
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
        ...(data.promoStartTime !== undefined && { promoStartTime: data.promoStartTime || null }),
        ...(data.promoEndTime !== undefined && { promoEndTime: data.promoEndTime || null }),
        ...(data.promoDays !== undefined && { promoDays: data.promoDays || null }),
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

    if (data.companyId) this.menuCache.invalidate(data.companyId);
    return updated;
  }

  async publicMenu(slugOrId: string) {
    const company = await this.prisma.company.findFirst({
      where: { OR: [{ id: slugOrId }, { slug: slugOrId }] },
      select: { id: true },
    });
    if (!company) return [];
    const companyId = company.id;

    // Cache em memória (30s) — cardápio digital chama isso a cada
    // carregamento de página, sempre pela mesma companyId real (nunca
    // pelo slug, resolvido acima) pra não duplicar entrada de cache.
    const cached = this.menuCache.get(companyId);
    if (cached) return cached;

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
            availableFrom: true,
            availableTo: true,
            availableDays: true,
          },
        },
        sizes: { orderBy: { size: 'asc' } },
      },

      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    // Cardápio por ocasião — categoria com janela configurada
    // (availableFrom/To/Days) some do cardápio digital/Totem/Kely fora dela;
    // categoria sem nada configurado (o caso comum) passa direto, igual antes.
    // Avaliado UMA vez por chamada (não por produto) — mesmo `now` pra todos,
    // evita um produto da mesma categoria decidir diferente do vizinho por
    // ter cruzado a virada do minuto no meio do loop.
    const now = new Date();
    const visibleByOccasion = products.filter((p) => {
      if (!p.category) return true;
      return isWithinTimeWindow(
        p.category.availableFrom,
        p.category.availableTo,
        p.category.availableDays,
        now,
      );
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
    const result = visibleByOccasion.map((p) => {
      // Happy hour automático — fora da janela do produto, esconde o preço
      // "de" (originalPrice) tanto do produto quanto de cada tamanho; o
      // preço realmente cobrado (salePrice/ProductSize.price) nunca muda,
      // só o selo visual de promoção liga/desliga sozinho.
      const promoActive = isWithinTimeWindow(p.promoStartTime, p.promoEndTime, p.promoDays, now);
      const withPromoGate = promoActive
        ? p
        : {
            ...p,
            originalPrice: null,
            sizes: p.sizes.map((s) => ({ ...s, originalPrice: null })),
          };
      if (withPromoGate.imageUrl && withPromoGate.imageUrl.startsWith('data:')) {
        return {
          ...withPromoGate,
          imageUrl: `${backendUrl}/api/products/public/image/${p.id}?v=${p.updatedAt.getTime()}`,
        };
      }
      return withPromoGate;
    });
    this.menuCache.set(companyId, result);
    return result;
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

  /**
   * Social proof REAL pro cardápio digital — nunca inventa número. Dois
   * dados, ambos derivados de pedidos de verdade (Order + OnlineOrder, mesmo
   * union de getFrequentlyBoughtWith):
   *  - `ordersLastHour`: quantos pedidos (qualquer canal) saíram na última
   *    hora — "X pedidos saindo agora".
   *  - `topProductToday`: produto mais vendido HOJE (dia comercial de
   *    Brasília, ver common/utils/timezone.ts) por quantidade, não por
   *    contagem de pedidos — "Mais pedido do dia".
   * Se não houver nenhum pedido na hora/dia, devolve null/0 — o frontend
   * esconde a seção inteira em vez de mostrar "0 pedidos" (isso não é prova
   * social, é o oposto).
   */
  async getLiveSocialProof(slugOrId: string) {
    const company = await this.prisma.company.findFirst({
      where: { OR: [{ id: slugOrId }, { slug: slugOrId }] },
      select: { id: true },
    });
    if (!company) return { ordersLastHour: 0, topProductToday: null };
    const companyId = company.id;

    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const todayStart = getStartOfTodayBrazil();

    const [ordersLastHourCount, onlineOrdersLastHourCount, todayOrders, todayOnlineOrders] =
      await Promise.all([
        this.prisma.order.count({
          where: { companyId, status: { not: 'CANCELLED' }, createdAt: { gte: hourAgo } },
        }),
        this.prisma.onlineOrder.count({
          where: { companyId, orderStatus: { not: 'CANCELED' }, createdAt: { gte: hourAgo } },
        }),
        this.prisma.order.findMany({
          where: { companyId, status: { not: 'CANCELLED' }, createdAt: { gte: todayStart } },
          select: { items: { select: { productId: true, quantity: true } } },
          take: 500,
        }),
        this.prisma.onlineOrder.findMany({
          where: { companyId, orderStatus: { not: 'CANCELED' }, createdAt: { gte: todayStart } },
          select: { items: true },
          take: 500,
        }),
      ]);

    const qty = new Map<string, number>();
    const bumpQty = (id: string, n: number) => qty.set(id, (qty.get(id) ?? 0) + n);
    for (const order of todayOrders) {
      for (const item of order.items) {
        if (item.productId) bumpQty(item.productId, Number(item.quantity) || 1);
      }
    }
    for (const order of todayOnlineOrders) {
      const items = Array.isArray(order.items) ? (order.items as any[]) : [];
      for (const it of items) {
        if (it?.productId) bumpQty(it.productId, Number(it.quantity) || 1);
      }
    }

    let topProductToday: { id: string; name: string } | null = null;
    if (qty.size > 0) {
      const [topId] = [...qty.entries()].sort((a, b) => b[1] - a[1])[0];
      const top = await this.prisma.product.findFirst({
        where: { id: topId, companyId, isActive: true, deletedAt: null },
        select: { id: true, name: true },
      });
      if (top) topProductToday = top;
    }

    return {
      ordersLastHour: ordersLastHourCount + onlineOrdersLastHourCount,
      topProductToday,
    };
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

    this.menuCache.invalidate(companyId);
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

    this.menuCache.invalidate(companyId);
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

    this.menuCache.invalidate(companyId);
    return product;
  }
}
