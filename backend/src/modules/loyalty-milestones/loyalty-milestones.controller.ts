import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CompanyId } from '@/common/decorators/company-id.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { LoyaltyMilestonesService } from './loyalty-milestones.service';
import { UpdateLoyaltyMilestoneConfigDto } from './dto/update-config.dto';

@Controller('loyalty-milestones')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')
export class LoyaltyMilestonesController {
  constructor(private readonly svc: LoyaltyMilestonesService) {}

  @Get('config')
  getConfig(@CompanyId() companyId: string) {
    return this.svc.getConfig(companyId);
  }

  @Patch('config')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  updateConfig(@CompanyId() companyId: string, @Body() dto: UpdateLoyaltyMilestoneConfigDto) {
    return this.svc.updateConfig(companyId, dto);
  }

  @Get('pending')
  listPending(@CompanyId() companyId: string) {
    return this.svc.listPending(companyId);
  }

  @Post(':id/redeem')
  redeem(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.svc.redeem(id, companyId, user.userId);
  }
}
