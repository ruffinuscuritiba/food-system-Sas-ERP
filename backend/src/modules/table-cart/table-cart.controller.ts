import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { TableCartService } from './table-cart.service';

// Público — sem auth. O "convite" pro carrinho compartilhado é o próprio QR
// físico da mesa (?table=N), não um token; qualquer um que souber
// companyId+tableNumber só enxerga/edita o carrinho daquela mesa específica.
@Controller('table-cart')
export class TableCartController {
  constructor(private readonly service: TableCartService) {}

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get(':companyId/:tableNumber')
  get(
    @Param('companyId') companyId: string,
    @Param('tableNumber') tableNumber: string,
  ) {
    return this.service.get(companyId, tableNumber);
  }

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Put(':companyId/:tableNumber')
  save(
    @Param('companyId') companyId: string,
    @Param('tableNumber') tableNumber: string,
    @Body('items') items: unknown[],
  ) {
    return this.service.save(companyId, tableNumber, items);
  }
}
