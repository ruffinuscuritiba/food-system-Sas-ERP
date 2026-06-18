import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from 'src/database/prisma.service';
import { UpdateCompanySettingsDto } from './dto/update-settings.dto';

const VALID_PLANS = ['BASIC', 'PRO', 'ENTERPRISE'] as const;
type Plan = (typeof VALID_PLANS)[number];

@Injectable()
export class CompanyService {
  constructor(private prisma: PrismaService) {}

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
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
          },
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
      this.prisma.company.findUnique({
        where: { id: companyId },
        include: { modules: true },
      }),
      this.prisma.planConfig.findMany().catch(() => []),
    ]);
    if (!company) throw new NotFoundException('Empresa não encontrada');

    const fallback = {
      BASIC: {
        price: 149,
        label: 'Basic',
        tagline: 'Para começar com o essencial',
      },
      PRO: {
        price: 249,
        label: 'Pro',
        tagline: 'Para operações em crescimento',
      },
      ENTERPRISE: {
        price: 399,
        label: 'Enterprise',
        tagline: 'Tudo liberado, sem limites',
      },
    } as Record<string, { price: number; label: string; tagline: string }>;

    const planPrices =
      planConfigs.length > 0
        ? planConfigs.reduce(
            (acc: any, c: any) => ({
              ...acc,
              [c.plan]: {
                price: Number(c.price),
                label: c.label,
                tagline: c.tagline,
              },
            }),
            {},
          )
        : fallback;

    return {
      plan: company.plan || 'BASIC',
      subscriptionStatus: company.subscriptionStatus,
      dueDate: company.dueDate,
      modules: company.modules,
      planPrices,
    };
  }

  // ── Área de Configurações ──────────────────────────────────────────────────

  /** Retorna os campos de configuração da loja para a área de configurações. */
  async getSettings(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        description: true,
        phone: true,
        whatsapp: true,
        email: true,
        cnpj: true,
        razaoSocial: true,
        zipCode: true,
        street: true,
        streetNumber: true,
        complement: true,
        neighborhood: true,
        city: true,
        state: true,
        businessHours: true,
        deliveryMethod: true,
        freeDeliveryAbove: true,
        ownDelivery: true,
        maxDeliveryRadius: true,
        storeLat: true,
        storeLng: true,
        acceptDelivery: true,
        acceptPickup: true,
        acceptDineIn: true,
        estimatedPrepTime: true,
        minimumOrderAmount: true,
        acceptCash: true,
        acceptCreditCard: true,
        acceptDebitCard: true,
        acceptMealVoucher: true,
        customPaymentMethods: true,
        printingSettings: true,
        businessSegment: true,
        layoutType: true,
        buttonRadius: true,
        repasseFrequency: true,
        repasseTime: true,
        repasseWeekday: true,
        creditReleasePlan: true,
        bankAccountData: true,
        walletBalance: true,
      },
    });
    if (!company) throw new NotFoundException('Empresa não encontrada');
    return company;
  }

  /** Atualiza os campos de configuração da loja (patch parcial). */
  async updateSettings(companyId: string, dto: UpdateCompanySettingsDto) {
    const exists = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Empresa não encontrada');

    return this.prisma.company.update({
      where: { id: companyId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.whatsapp !== undefined && { whatsapp: dto.whatsapp }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.cnpj !== undefined && { cnpj: dto.cnpj }),
        ...(dto.razaoSocial !== undefined && { razaoSocial: dto.razaoSocial }),
        ...(dto.zipCode !== undefined && { zipCode: dto.zipCode }),
        ...(dto.street !== undefined && { street: dto.street }),
        ...(dto.streetNumber !== undefined && { streetNumber: dto.streetNumber }),
        ...(dto.complement !== undefined && { complement: dto.complement }),
        ...(dto.neighborhood !== undefined && { neighborhood: dto.neighborhood }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.state !== undefined && { state: dto.state }),
        ...(dto.businessHours !== undefined && {
          businessHours: JSON.parse(JSON.stringify(dto.businessHours)),
        }),
        ...(dto.deliveryMethod !== undefined && { deliveryMethod: dto.deliveryMethod }),
        ...(dto.freeDeliveryAbove !== undefined && {
          freeDeliveryAbove: dto.freeDeliveryAbove === null ? null : dto.freeDeliveryAbove,
        }),
        ...(dto.ownDelivery !== undefined && { ownDelivery: dto.ownDelivery }),
        ...(dto.maxDeliveryRadius !== undefined && {
          maxDeliveryRadius: dto.maxDeliveryRadius === null ? null : dto.maxDeliveryRadius,
        }),
        ...(dto.storeLat !== undefined && { storeLat: dto.storeLat }),
        ...(dto.storeLng !== undefined && { storeLng: dto.storeLng }),
        ...(dto.acceptDelivery !== undefined && { acceptDelivery: dto.acceptDelivery }),
        ...(dto.acceptPickup !== undefined && { acceptPickup: dto.acceptPickup }),
        ...(dto.acceptDineIn !== undefined && { acceptDineIn: dto.acceptDineIn }),
        ...(dto.estimatedPrepTime !== undefined && { estimatedPrepTime: dto.estimatedPrepTime }),
        ...(dto.minimumOrderAmount !== undefined && {
          minimumOrderAmount: dto.minimumOrderAmount === null ? null : dto.minimumOrderAmount,
        }),
        ...(dto.acceptCash !== undefined && { acceptCash: dto.acceptCash }),
        ...(dto.acceptCreditCard !== undefined && { acceptCreditCard: dto.acceptCreditCard }),
        ...(dto.acceptDebitCard !== undefined && { acceptDebitCard: dto.acceptDebitCard }),
        ...(dto.acceptMealVoucher !== undefined && { acceptMealVoucher: dto.acceptMealVoucher }),
        ...(dto.customPaymentMethods !== undefined && {
          customPaymentMethods: JSON.parse(JSON.stringify(dto.customPaymentMethods)),
        }),
        ...(dto.printingSettings !== undefined && {
          printingSettings: JSON.parse(JSON.stringify(dto.printingSettings)),
        }),
        ...(dto.businessSegment !== undefined && { businessSegment: dto.businessSegment }),
        ...(dto.layoutType !== undefined && { layoutType: dto.layoutType }),
        ...(dto.buttonRadius !== undefined && { buttonRadius: dto.buttonRadius }),
        ...(dto.repasseFrequency !== undefined && { repasseFrequency: dto.repasseFrequency }),
        ...(dto.repasseTime !== undefined && { repasseTime: dto.repasseTime }),
        ...(dto.repasseWeekday !== undefined && { repasseWeekday: dto.repasseWeekday }),
        ...(dto.creditReleasePlan !== undefined && { creditReleasePlan: dto.creditReleasePlan }),
        ...(dto.bankAccountData !== undefined && {
          bankAccountData: dto.bankAccountData === null ? null : JSON.parse(JSON.stringify(dto.bankAccountData)),
        }),
      },
      select: {
        id: true,
        name: true,
        description: true,
        phone: true,
        whatsapp: true,
        email: true,
        cnpj: true,
        razaoSocial: true,
        zipCode: true,
        street: true,
        streetNumber: true,
        complement: true,
        neighborhood: true,
        city: true,
        state: true,
        businessHours: true,
        deliveryMethod: true,
        freeDeliveryAbove: true,
        ownDelivery: true,
        maxDeliveryRadius: true,
        storeLat: true,
        storeLng: true,
        acceptDelivery: true,
        acceptPickup: true,
        acceptDineIn: true,
        estimatedPrepTime: true,
        minimumOrderAmount: true,
        acceptCash: true,
        acceptCreditCard: true,
        acceptDebitCard: true,
        acceptMealVoucher: true,
        customPaymentMethods: true,
        printingSettings: true,
        businessSegment: true,
        layoutType: true,
        buttonRadius: true,
        repasseFrequency: true,
        repasseTime: true,
        repasseWeekday: true,
        creditReleasePlan: true,
        bankAccountData: true,
        walletBalance: true,
      },
    });
  }

  /** Abate mensalidade pendente do walletBalance antes do repasse PIX. */
  async deductPendingSubscription(companyId: string): Promise<{
    deducted: number;
    walletBalance: number;
  }> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { subscriptionStatus: true, walletBalance: true, plan: true },
    });
    if (!company) return { deducted: 0, walletBalance: 0 };

    const PLAN_PRICES: Record<string, number> = { BASIC: 97, PRO: 197, DELIVERY: 197, ENTERPRISE: 397 };
    const isOverdue =
      company.subscriptionStatus !== 'ACTIVE' && Number(company.walletBalance) > 0;

    if (!isOverdue) return { deducted: 0, walletBalance: Number(company.walletBalance) };

    const fee = PLAN_PRICES[company.plan] ?? 97;
    const wallet = Number(company.walletBalance);
    const deducted = Math.min(fee, wallet);
    const newBalance = wallet - deducted;

    await this.prisma.company.update({
      where: { id: companyId },
      data: { walletBalance: newBalance },
    });

    return { deducted, walletBalance: newBalance };
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
      data: { plan },
      select: { id: true, name: true, plan: true, subscriptionStatus: true },
    });
  }
}
