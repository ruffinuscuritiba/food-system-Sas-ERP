import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { isMatrixCompany } from '@/common/utils/matrix';

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
      this.prisma.module.findMany({
        where: { isActive: true },
        orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
      }),
      this.prisma.companyModule.findMany({ where: { companyId } }),
    ]);

    return catalog.map((mod) => {
      const cm = companyModules.find((cm) => cm.moduleSlug === mod.slug);
      const isTrialExpired =
        cm?.status === 'TRIAL' && cm.trialEndsAt && new Date() > cm.trialEndsAt;
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
      update: {
        status: 'ACTIVE',
        active: true,
        activatedAt: new Date(),
        trialEndsAt: null,
      },
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
    return this.prisma.companyModule.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  create(data: any) {
    return this.prisma.companyModule.create({ data });
  }

  /**
   * Retorna lista reduzida de empresas para o seletor de provisionamento.
   * Restrito a SUPER_ADMIN ou empresa matriz.
   */
  async listCompaniesForAdmin(requestingCompanyId: string, userRole: string) {
    if (userRole !== 'SUPER_ADMIN' && !isMatrixCompany(requestingCompanyId)) {
      throw new ForbiddenException('Acesso restrito a SUPER_ADMIN');
    }
    return this.prisma.company.findMany({
      select: { id: true, name: true, plan: true },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Ativa um módulo em OUTRA empresa (provisionamento cross-tenant).
   * Só SUPER_ADMIN ou a empresa matriz podem fazer isso.
   */
  async adminActivate(
    requestingCompanyId: string,
    userRole: string,
    targetCompanyId: string,
    moduleSlug: string,
  ) {
    if (userRole !== 'SUPER_ADMIN' && !isMatrixCompany(requestingCompanyId)) {
      throw new ForbiddenException(
        'Apenas SUPER_ADMIN pode ativar módulos para outras empresas',
      );
    }
    const target = await this.prisma.company.findUnique({
      where: { id: targetCompanyId },
      select: { id: true },
    });
    if (!target) {
      throw new ForbiddenException('Empresa de destino não encontrada');
    }
    return this.activateModule(targetCompanyId, moduleSlug);
  }
}
