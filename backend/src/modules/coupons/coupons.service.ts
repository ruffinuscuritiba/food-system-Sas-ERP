import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';

export interface CouponValidationResult {
  valid: boolean;
  discount: number;
  isPercent: boolean;
  message: string;
  couponId?: string;
}

@Injectable()
export class CouponsService {
  private readonly logger = new Logger(CouponsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async validate(
    code: string,
    companyId: string,
    orderTotal: number,
  ): Promise<CouponValidationResult> {
    if (!code || !companyId) {
      return {
        valid: false,
        discount: 0,
        isPercent: false,
        message: 'Código inválido.',
      };
    }

    const coupon = await this.prisma.coupon.findUnique({
      where: { code_companyId: { code: code.trim().toUpperCase(), companyId } },
    });

    if (!coupon || !coupon.isActive) {
      return {
        valid: false,
        discount: 0,
        isPercent: false,
        message: 'Cupom inválido ou inativo.',
      };
    }

    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      return {
        valid: false,
        discount: 0,
        isPercent: false,
        message: 'Cupom expirado.',
      };
    }

    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      return {
        valid: false,
        discount: 0,
        isPercent: false,
        message: 'Cupom esgotado.',
      };
    }

    const rawDiscount = Number(coupon.discount);
    const discount = coupon.isPercent
      ? Math.min((orderTotal * rawDiscount) / 100, orderTotal)
      : Math.min(rawDiscount, orderTotal);

    const message = coupon.isPercent
      ? `${rawDiscount}% de desconto aplicado! 🎉`
      : `R$ ${rawDiscount.toFixed(2)} de desconto aplicado! 🎉`;

    return {
      valid: true,
      discount,
      isPercent: coupon.isPercent,
      message,
      couponId: coupon.id,
    };
  }

  async redeem(couponId: string): Promise<void> {
    await this.prisma.coupon
      .update({
        where: { id: couponId },
        data: { usedCount: { increment: 1 } },
      })
      .catch((err) => this.logger.warn(`Coupon redeem failed: ${err}`));
  }

  // Admin: list coupons for a company
  async list(companyId: string) {
    return this.prisma.coupon.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Admin: create coupon
  async create(data: {
    companyId: string;
    code: string;
    discount: number;
    isPercent?: boolean;
    maxUses?: number;
    expiresAt?: string;
  }) {
    return this.prisma.coupon.create({
      data: {
        companyId: data.companyId,
        code: data.code.trim().toUpperCase(),
        discount: data.discount,
        isPercent: data.isPercent ?? false,
        maxUses: data.maxUses ?? null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      },
    });
  }

  // Admin: toggle active
  async toggle(id: string, companyId: string) {
    const coupon = await this.prisma.coupon.findFirst({
      where: { id, companyId },
    });
    if (!coupon) return null;
    return this.prisma.coupon.update({
      where: { id },
      data: { isActive: !coupon.isActive },
    });
  }
}
