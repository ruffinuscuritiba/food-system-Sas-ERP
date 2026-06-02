import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from 'src/database/prisma.service';

const VALID_PLANS = ['BASIC', 'PRO', 'ENTERPRISE'] as const;
type Plan = typeof VALID_PLANS[number];

@Injectable()
export class CompanyService {
  constructor(
    private prisma: PrismaService,
  ) {}

  async findAll() {
    return this.prisma.company.findMany({
      include: {
        modules: true,
        users: true,
      },

      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  findOne(id: string) {
    return this.prisma.company.findUnique({
      where: { id },
      include: {
        modules: true,
        users: {
          select: { id: true, name: true, email: true, role: true, isActive: true },
        },
      },
    });
  }

  create(data: any) {
    return this.prisma.company.create({
      data,
    });
  }

  update(id: string, data: any) {
    return this.prisma.company.update({
      where: { id },
      data,
    });
  }

  blockCompany(id: string) {
    return this.prisma.company.update({
      where: {
        id,
      },

      data: {
        isBlocked: true,
      },
    });
  }

  unblockCompany(id: string) {
    return this.prisma.company.update({
      where: {
        id,
      },

      data: {
        isBlocked: false,
      },
    });
  }

  /** Retorna plano + módulos ativos + preços de plano para a página /assinatura */
  async getSubscription(companyId: string) {
    const [company, planConfigs] = await Promise.all([
      this.prisma.company.findUnique({ where: { id: companyId }, include: { modules: true } }),
      this.prisma.planConfig.findMany().catch(() => []),
    ]);
    if (!company) throw new NotFoundException('Empresa não encontrada');

    const fallback = {
      BASIC:      { price: 149, label: 'Basic',      tagline: 'Para começar com o essencial' },
      PRO:        { price: 249, label: 'Pro',         tagline: 'Para operações em crescimento' },
      ENTERPRISE: { price: 399, label: 'Enterprise',  tagline: 'Tudo liberado, sem limites' },
    } as Record<string, { price: number; label: string; tagline: string }>;

    const planPrices = planConfigs.length > 0
      ? planConfigs.reduce((acc: any, c: any) => ({
          ...acc,
          [c.plan]: { price: Number(c.price), label: c.label, tagline: c.tagline },
        }), {})
      : fallback;

    return {
      plan:               company.plan || 'BASIC',
      subscriptionStatus: company.subscriptionStatus,
      dueDate:            company.dueDate,
      modules:            company.modules,
      planPrices,
    };
  }

  /** Atualiza apenas o plano. Nenhum dado de módulo é removido. */
  async updatePlan(companyId: string, plan: string) {
    if (!(VALID_PLANS as readonly string[]).includes(plan)) {
      throw new BadRequestException(
        `Plano inválido. Valores aceitos: ${VALID_PLANS.join(', ')}`,
      );
    }
    return this.prisma.company.update({
      where: { id: companyId },
      data:  { plan },
      select: { id: true, name: true, plan: true, subscriptionStatus: true },
    });
  }
}