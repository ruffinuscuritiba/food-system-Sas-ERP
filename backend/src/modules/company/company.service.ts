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

  /** Retorna plano + módulos ativos para a página /assinatura */
  async getSubscription(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: { modules: true },
    });
    if (!company) throw new NotFoundException('Empresa não encontrada');
    return {
      plan:               company.plan || 'BASIC',
      subscriptionStatus: company.subscriptionStatus,
      dueDate:            company.dueDate,
      modules:            company.modules,
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