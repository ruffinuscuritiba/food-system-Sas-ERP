import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  Param,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { LoyaltyService } from '@/modules/loyalty/loyalty.service';

@Controller('coupons')
export class CouponsController {
  constructor(private readonly loyalty: LoyaltyService) {}

  /**
   * PUBLIC — called by menu page to validate coupon before order.
   * LoyaltyService.validateCoupon() throws on invalid/expired/etc (idiomatic
   * for a service) — bridged here to the {valid:false, message} shape the
   * checkout frontend expects, so a bad coupon renders as a normal inline
   * message instead of a fetch-level error.
   */
  @Post('validate')
  async validate(
    @Body()
    body: {
      code: string;
      companyId: string;
      orderTotal?: number;
      customerId?: string;
      items?: { productId: string; quantity: number; unitPrice: number }[];
    },
  ) {
    if (!body.code || !body.companyId) {
      throw new BadRequestException('code e companyId são obrigatórios.');
    }
    try {
      const result = await this.loyalty.validateCoupon(
        body.code,
        body.companyId,
        body.orderTotal ?? 0,
        body.customerId,
        body.items,
      );
      return { valid: true, ...result };
    } catch (err: any) {
      return {
        valid: false,
        discount: 0,
        message: err?.message ?? 'Cupom inválido ou expirado.',
      };
    }
  }

  /** PUBLIC — called after successful order to increment usageCount */
  @Post('redeem')
  redeem(@Body() body: { couponId: string }) {
    if (!body.couponId)
      throw new BadRequestException('couponId é obrigatório.');
    return this.loyalty.redeemCoupon(body.couponId);
  }

  /** ADMIN — list company coupons */
  @UseGuards(JwtAuthGuard)
  @Get()
  list(@Query('companyId') companyId: string) {
    if (!companyId) throw new BadRequestException('companyId é obrigatório.');
    return this.loyalty.listCoupons(companyId);
  }

  /** ADMIN — create coupon */
  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Body()
    body: {
      companyId: string;
      code: string;
      type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING';
      value: number;
      minOrderAmount?: number;
      maxDiscount?: number;
      usageLimit?: number;
      expiresAt?: string;
      customerId?: string;
    },
  ) {
    return this.loyalty.createCoupon({
      ...body,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    });
  }

  /** ADMIN — toggle active/inactive */
  @UseGuards(JwtAuthGuard)
  @Patch(':id/toggle')
  toggle(@Param('id') id: string, @Query('companyId') companyId: string) {
    if (!companyId) throw new BadRequestException('companyId é obrigatório.');
    return this.loyalty.toggleCoupon(id, companyId);
  }
}
