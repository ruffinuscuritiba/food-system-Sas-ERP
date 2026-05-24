import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';

// 1 point per R$1 spent | 10 points = R$1 discount
export const POINTS_PER_REAL = 1;
export const POINTS_PER_REAL_DISCOUNT = 10; // 10 points → R$1 off

@Injectable()
export class LoyaltyService {
  private readonly logger = new Logger(LoyaltyService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getBalance(phone: string, companyId: string) {
    const account = await this.prisma.loyaltyAccount.findUnique({
      where: { phone_companyId: { phone, companyId } },
    });

    if (!account) {
      return { points: 0, discountValue: 0, totalOrders: 0, totalSpent: 0 };
    }

    return {
      points: account.points,
      discountValue: Math.floor(account.points / POINTS_PER_REAL_DISCOUNT),
      totalOrders: account.totalOrders,
      totalSpent: Number(account.totalSpent),
    };
  }

  async awardPoints(
    phone: string,
    companyId: string,
    orderId: string,
    totalAmount: number,
  ): Promise<void> {
    try {
      const pointsEarned = Math.floor(totalAmount * POINTS_PER_REAL);
      if (pointsEarned <= 0) return;

      const account = await this.prisma.loyaltyAccount.upsert({
        where: { phone_companyId: { phone, companyId } },
        create: {
          phone,
          companyId,
          points: pointsEarned,
          totalOrders: 1,
          totalSpent: totalAmount,
        },
        update: {
          points: { increment: pointsEarned },
          totalOrders: { increment: 1 },
          totalSpent: { increment: totalAmount },
        },
      });

      await this.prisma.pointTransaction.create({
        data: {
          loyaltyAccountId: account.id,
          companyId,
          type: 'EARN',
          points: pointsEarned,
          orderId,
          description: `Pedido #${orderId.slice(-8).toUpperCase()} — +${pointsEarned} pts`,
        },
      });

      this.logger.log(
        `Loyalty: +${pointsEarned} pts for phone=${phone} company=${companyId} order=${orderId}`,
      );
    } catch (err) {
      this.logger.error(`Failed to award loyalty points: ${err}`);
    }
  }

  async validateAndRedeem(
    phone: string,
    companyId: string,
    pointsToRedeem: number,
  ): Promise<number> {
    if (pointsToRedeem <= 0) return 0;

    const account = await this.prisma.loyaltyAccount.findUnique({
      where: { phone_companyId: { phone, companyId } },
    });

    if (!account || account.points < pointsToRedeem) {
      throw new BadRequestException('Pontos insuficientes.');
    }

    // Must redeem in multiples of POINTS_PER_REAL_DISCOUNT
    const validPoints =
      Math.floor(pointsToRedeem / POINTS_PER_REAL_DISCOUNT) *
      POINTS_PER_REAL_DISCOUNT;

    if (validPoints <= 0) {
      throw new BadRequestException(
        `Mínimo de ${POINTS_PER_REAL_DISCOUNT} pontos para resgatar.`,
      );
    }

    const discountValue = Math.floor(validPoints / POINTS_PER_REAL_DISCOUNT);

    await this.prisma.loyaltyAccount.update({
      where: { id: account.id },
      data: { points: { decrement: validPoints } },
    });

    await this.prisma.pointTransaction.create({
      data: {
        loyaltyAccountId: account.id,
        companyId,
        type: 'REDEEM',
        points: -validPoints,
        description: `Resgate de ${validPoints} pts = R$${discountValue},00 de desconto`,
      },
    });

    this.logger.log(
      `Loyalty: -${validPoints} pts redeemed for phone=${phone} → R$${discountValue} discount`,
    );

    return discountValue;
  }
}
