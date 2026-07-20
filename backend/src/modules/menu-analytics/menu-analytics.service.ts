import { Injectable } from '@nestjs/common';

import { PrismaService } from '@/database/prisma.service';
import { CompanyService } from '@/modules/company/company.service';

const VALID_TYPES = ['MENU_VIEW', 'PRODUCT_VIEW'];

@Injectable()
export class MenuAnalyticsService {
  constructor(
    private prisma: PrismaService,
    private companyService: CompanyService,
  ) {}

  async track(companySlugOrId: string, type: string, productId?: string) {
    if (!VALID_TYPES.includes(type)) return { ok: false };
    const companyId = await this.companyService.resolveId(companySlugOrId);
    if (!companyId) return { ok: false };

    await this.prisma.menuAnalyticsEvent.create({
      data: {
        companyId,
        type,
        productId: productId || null,
      },
    });
    return { ok: true };
  }

  async getSummary(companyId: string, from: Date, to: Date) {
    const [totalMenuViews, productViewEvents] = await Promise.all([
      this.prisma.menuAnalyticsEvent.count({
        where: { companyId, type: 'MENU_VIEW', createdAt: { gte: from, lte: to } },
      }),
      this.prisma.menuAnalyticsEvent.findMany({
        where: {
          companyId,
          type: 'PRODUCT_VIEW',
          productId: { not: null },
          createdAt: { gte: from, lte: to },
        },
        select: { productId: true },
      }),
    ]);

    const counts = new Map<string, number>();
    for (const event of productViewEvents) {
      if (!event.productId) continue;
      counts.set(event.productId, (counts.get(event.productId) ?? 0) + 1);
    }

    const topIds = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id]) => id);

    const products = topIds.length
      ? await this.prisma.product.findMany({
          where: { id: { in: topIds }, companyId },
          select: { id: true, name: true, imageUrl: true, salePrice: true },
        })
      : [];

    const topViewedProducts = topIds
      .map((id) => {
        const product = products.find((p) => p.id === id);
        if (!product) return null;
        return {
          productId: id,
          name: product.name,
          imageUrl: product.imageUrl,
          salePrice: Number(product.salePrice) || 0,
          views: counts.get(id) ?? 0,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    return {
      totalMenuViews,
      totalProductViews: productViewEvents.length,
      topViewedProducts,
    };
  }
}
