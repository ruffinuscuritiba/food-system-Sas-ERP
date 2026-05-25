import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';

@Injectable()
export class CompanyModuleService {
  constructor(private prisma: PrismaService) {}

  getCatalog() {
    return this.prisma.module.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  async getCompanyModules(companyId: string) {
    const [catalog, companyModules] = await Promise.all([
      this.prisma.module.findMany({ where: { isActive: true }, orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }] }),
      this.prisma.companyModule.findMany({ where: { companyId } }),
    ]);

    return catalog.map((mod) => {
      const cm = companyModules.find((cm) => cm.moduleSlug === mod.slug);
      const isTrialExpired = cm?.status === 'TRIAL' && cm.trialEndsAt && new Date() > cm.trialEndsAt;
      return {
        ...mod,
        companyModuleId: cm?.id ?? null,
        status: isTrialExpired ? 'EXPIRED' : (cm?.status ?? 'INACTIVE'),
        trialEndsAt: cm?.trialEndsAt ?? null,
        activatedAt: cm?.activatedAt ?? null,
      };
    });
  }

  async startTrial(companyId: string, moduleSlug: string) {
    const existing = await this.prisma.companyModule.findUnique({
      where: { id: `cm-${moduleSlug}-${companyId}` },
    });

    if (existing?.trialEndsAt) {
      throw new Error('Você já utilizou o teste grátis para este módulo.');
    }

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 5);

    return this.prisma.companyModule.upsert({
      where: { id: `cm-${moduleSlug}-${companyId}` },
      update: { status: 'TRIAL', trialEndsAt, moduleSlug },
      create: {
        id: `cm-${moduleSlug}-${companyId}`,
        module: moduleSlug.toUpperCase(),
        active: false,
        moduleSlug,
        status: 'TRIAL',
        trialEndsAt,
        companyId,
      },
    });
  }

  async activateModule(companyId: string, moduleSlug: string) {
    return this.prisma.companyModule.upsert({
      where: { id: `cm-${moduleSlug}-${companyId}` },
      update: { status: 'ACTIVE', active: true, activatedAt: new Date(), trialEndsAt: null },
      create: {
        id: `cm-${moduleSlug}-${companyId}`,
        module: moduleSlug.toUpperCase(),
        active: true,
        moduleSlug,
        status: 'ACTIVE',
        activatedAt: new Date(),
        companyId,
      },
    });
  }

  async deactivateModule(companyId: string, moduleSlug: string) {
    return this.prisma.companyModule.updateMany({
      where: { companyId, moduleSlug },
      data: { status: 'INACTIVE', active: false },
    });
  }

  findAll() {
    return this.prisma.companyModule.findMany({ orderBy: { createdAt: 'desc' } });
  }

  create(data: any) {
    return this.prisma.companyModule.create({ data });
  }
}
