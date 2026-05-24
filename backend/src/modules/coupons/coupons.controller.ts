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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CouponsService } from './coupons.service';

@Controller('coupons')
export class CouponsController {
  constructor(private readonly service: CouponsService) {}

  /** PUBLIC — called by menu page to validate coupon before order */
  @Post('validate')
  validate(
    @Body() body: { code: string; companyId: string; orderTotal?: number },
  ) {
    if (!body.code || !body.companyId) {
      throw new BadRequestException('code e companyId são obrigatórios.');
    }
    return this.service.validate(body.code, body.companyId, body.orderTotal ?? 0);
  }

  /** PUBLIC — called after successful order to increment usedCount */
  @Post('redeem')
  redeem(@Body() body: { couponId: string }) {
    if (!body.couponId) throw new BadRequestException('couponId é obrigatório.');
    return this.service.redeem(body.couponId);
  }

  /** ADMIN — list company coupons */
  @UseGuards(JwtAuthGuard)
  @Get()
  list(@Query('companyId') companyId: string) {
    if (!companyId) throw new BadRequestException('companyId é obrigatório.');
    return this.service.list(companyId);
  }

  /** ADMIN — create coupon */
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() body: any) {
    return this.service.create(body);
  }

  /** ADMIN — toggle active/inactive */
  @UseGuards(JwtAuthGuard)
  @Patch(':id/toggle')
  toggle(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.toggle(id, companyId);
  }
}
