import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

// Regras configuráveis por loja (idealmente viria de Company settings)
const POINTS_PER_REAL = 1;        // 1 ponto por R$ 1,00
const CASHBACK_RATE = 0.02;       // 2% cashback

@Injectable()
export class LoyaltyService {
  private readonly logger = new Logger(LoyaltyService.name);

  constructor(private prisma: PrismaService) {}

  // ── Chamado após pedido APROVADO (hook em orders.service) ──
  async processOrderReward(
    customerId: string,
    companyId: string,
    orderId: string,
    orderAmount: number,
  ) {
    const points = Math.floor(orderAmount * POINTS_PER_REAL);
    const cashback = new Decimal(orderAmount * CASHBACK_RATE).toDecimalPlaces(2);

    const account = await this.upsertAccount(customerId, companyId);

    await this.prisma.$transaction([
      // Adiciona pontos
      this.prisma.pointTransaction.create({
        data: {
          loyaltyAccountId: account.id,
          orderId,
          points,
          type: 'EARNED',
          description: `Pontos pelo pedido #${orderId.slice(-6).toUpperCase()}`,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 ano
        },
      }),
      // Atualiza saldo
      this.prisma.loyaltyAccount.update({
        where: { id: account.id },
        data: {
          totalPoints: { increment: points },
          totalCashback: { increment: cashback },
        },
      }),
    ]);

    this.logger.log(
      `Fidelidade: +${points} pontos para cliente ${customerId} no pedido ${orderId}`,
    );

    return { points, cashback };
  }

  // ── Valida e aplica cupom num pedido ──────────────────────
  async validateCoupon(
    code: string,
    companyId: string,
    orderAmount: number,
    customerId?: string,
  ) {
    const coupon = await this.prisma.coupon.findFirst({
      where: {
        code: code.toUpperCase().trim(),
        companyId,
        active: true,
        AND: [
          { OR: [{ customerId: null }, { customerId }] },
          { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        ],
      },
    });

    if (!coupon) throw new NotFoundException('Cupom inválido ou expirado');

    if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
      throw new NotFoundException('Cupom inválido ou expirado');
    }

    if (coupon.minOrderAmount && orderAmount < Number(coupon.minOrderAmount)) {
      throw new BadRequestException(
        `Pedido mínimo para este cupom: R$ ${coupon.minOrderAmount}`,
      );
    }

    let discount = 0;
    if (coupon.type === 'PERCENTAGE') {
      discount = orderAmount * (Number(coupon.value) / 100);
      if (coupon.maxDiscount) discount = Math.min(discount, Number(coupon.maxDiscount));
    } else if (coupon.type === 'FIXED_AMOUNT') {
      discount = Math.min(Number(coupon.value), orderAmount);
    }

    return {
      couponId: coupon.id,
      code: coupon.code,
      type: coupon.type,
      discount: new Decimal(discount).toDecimalPlaces(2),
      finalAmount: new Decimal(orderAmount - discount).toDecimalPlaces(2),
    };
  }

  // ── Resgate de pontos por cupom ───────────────────────────
  async redeemPoints(
    customerId: string,
    companyId: string,
    pointsToRedeem: number,
  ) {
    const account = await this.prisma.loyaltyAccount.findUnique({
      where: { customerId_companyId: { customerId, companyId } },
    });

    if (!account) throw new NotFoundException('Conta de fidelidade não encontrada');
    if (account.totalPoints < pointsToRedeem) {
      throw new BadRequestException(
        `Saldo insuficiente. Você tem ${account.totalPoints} pontos`,
      );
    }

    // 100 pontos = R$ 5,00
    const discountValue = new Decimal(pointsToRedeem / 100 * 5).toDecimalPlaces(2);

    // Gera cupom temporário
    const couponCode = `PONTOS${Date.now().toString(36).toUpperCase()}`;
    await this.prisma.$transaction([
      this.prisma.coupon.create({
        data: {
          companyId,
          code: couponCode,
          type: 'FIXED_AMOUNT',
          value: discountValue,
          customerId,
          usageLimit: 1,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias
          pointsCost: pointsToRedeem,
        },
      }),
      this.prisma.pointTransaction.create({
        data: {
          loyaltyAccountId: account.id,
          points: -pointsToRedeem,
          type: 'REDEEMED',
          description: `Resgate de ${pointsToRedeem} pontos — cupom ${couponCode}`,
        },
      }),
      this.prisma.loyaltyAccount.update({
        where: { id: account.id },
        data: { totalPoints: { decrement: pointsToRedeem } },
      }),
    ]);

    return { couponCode, discountValue };
  }

  // ── Saldo da conta de fidelidade ──────────────────────────
  async getBalance(customerId: string, companyId: string) {
    const account = await this.prisma.loyaltyAccount.findUnique({
      where: { customerId_companyId: { customerId, companyId } },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!account) return { totalPoints: 0, totalCashback: 0, transactions: [] };
    return account;
  }

  // ── Cria cupom manual (admin) ─────────────────────────────
  async createCoupon(data: {
    companyId: string;
    code: string;
    type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING';
    value: number;
    minOrderAmount?: number;
    maxDiscount?: number;
    usageLimit?: number;
    expiresAt?: Date;
    customerId?: string;
  }) {
    return this.prisma.coupon.create({
      data: {
        ...data,
        code: data.code.toUpperCase().trim(),
      },
    });
  }

  private async upsertAccount(customerId: string, companyId: string) {
    return this.prisma.loyaltyAccount.upsert({
      where: { customerId_companyId: { customerId, companyId } },
      create: { customerId, companyId, totalPoints: 0 },
      update: {},
    });
  }
}