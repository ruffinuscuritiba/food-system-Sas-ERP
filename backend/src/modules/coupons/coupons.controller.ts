import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Param,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CompanyId } from '@/common/decorators/company-id.decorator';
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

  /** ADMIN — list company coupons (PDV "Criar Cupom" e telas futuras de gestão) */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')
  @Get()
  list(@CompanyId() companyId: string) {
    return this.loyalty.listCoupons(companyId);
  }

  /**
   * ADMIN — create coupon. companyId vem SEMPRE do JWT (@CompanyId), nunca
   * do body — corpo pode mandar `companyId` mas é ignorado, para não
   * confiar num valor que o cliente poderia adulterar.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')
  @Post()
  create(
    @CompanyId() companyId: string,
    @Body()
    body: {
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
    if (!body.code || !body.type) {
      throw new BadRequestException('code e type são obrigatórios.');
    }
    return this.loyalty.createCoupon({
      ...body,
      companyId,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    });
  }

  /** ADMIN — toggle active/inactive */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')
  @Patch(':id/toggle')
  toggle(@Param('id') id: string, @CompanyId() companyId: string) {
    return this.loyalty.toggleCoupon(id, companyId);
  }
}
