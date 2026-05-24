import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';

@Controller('loyalty')
export class LoyaltyController {
  constructor(private readonly service: LoyaltyService) {}

  /** Public — no auth required */
  @Get('balance')
  getBalance(
    @Query('phone') phone: string,
    @Query('companyId') companyId: string,
  ) {
    if (!phone || !companyId) {
      throw new BadRequestException('phone e companyId são obrigatórios.');
    }
    return this.service.getBalance(phone, companyId);
  }
}
