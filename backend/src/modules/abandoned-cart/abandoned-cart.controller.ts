import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AbandonedCartService } from './abandoned-cart.service';

@Controller('abandoned-cart')
export class AbandonedCartController {
  constructor(private readonly service: AbandonedCartService) {}

  // Público — chamado pelo cardápio digital, debounced, a cada mudança de
  // carrinho/telefone durante o checkout.
  @Post('track')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  track(
    @Body('companyId') companyId: string,
    @Body('phone') phone: string,
    @Body('customerName') customerName: string | undefined,
    @Body('items') items: { name: string; quantity: number }[],
    @Body('total') total: number,
  ) {
    return this.service.track(companyId, phone, customerName, items, total);
  }
}
