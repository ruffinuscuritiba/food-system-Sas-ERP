import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CompanyId } from '@/common/decorators/company-id.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { WhatsappCampaignsService } from './whatsapp-campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';

@Controller('whatsapp-campaigns')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
export class WhatsappCampaignsController {
  constructor(private readonly service: WhatsappCampaignsService) {}

  @Get('summary')
  getSummary(@CompanyId() companyId: string) {
    return this.service.getSummary(companyId);
  }

  @Get()
  list(@CompanyId() companyId: string) {
    return this.service.listCampaigns(companyId);
  }

  @Post()
  create(
    @CompanyId() companyId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateCampaignDto,
  ) {
    return this.service.createCampaign(companyId, user.userId, dto);
  }

  @Patch(':id/activate')
  activate(@Param('id') id: string, @CompanyId() companyId: string) {
    return this.service.activateCampaign(id, companyId);
  }

  @Patch(':id/pause')
  pause(@Param('id') id: string, @CompanyId() companyId: string) {
    return this.service.pauseCampaign(id, companyId);
  }

  @Get(':id/sends')
  sends(@Param('id') id: string, @CompanyId() companyId: string) {
    return this.service.getCampaignSends(id, companyId);
  }
}
