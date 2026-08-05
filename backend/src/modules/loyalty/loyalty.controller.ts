import { Body, Controller, Get, Patch, Query, BadRequestException, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CompanyId } from '@/common/decorators/company-id.decorator';
import { LoyaltyService } from './loyalty.service';
import { UpdateCashbackConfigDto } from './dto/update-cashback-config.dto';

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

  /** Público — checkout do cardápio digital precisa saber a taxa antes de mostrar a opção. */
  @Get('cashback-config/public')
  getPublicCashbackConfig(@Query('companyId') companyId: string) {
    if (!companyId) throw new BadRequestException('companyId é obrigatório.');
    return this.service.getPublicCashbackConfig(companyId);
  }

  @Get('cashback-config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  getCashbackConfig(@CompanyId() companyId: string) {
    return this.service.getCashbackConfig(companyId);
  }

  @Patch('cashback-config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  updateCashbackConfig(@CompanyId() companyId: string, @Body() dto: UpdateCashbackConfigDto) {
    return this.service.updateCashbackConfig(companyId, dto);
  }
}
