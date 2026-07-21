import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CompanyId } from '@/common/decorators/company-id.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { WhatsappCampaignsService } from './whatsapp-campaigns.service';
import { CreateCampaignDto, UpdateCampaignDto } from './dto/create-campaign.dto';
import { AddContactsDto } from './dto/add-contacts.dto';

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

  // Rota fixa ANTES de ':id' — match-by-order do Nest.
  @Post('contacts')
  addContacts(@CompanyId() companyId: string, @Body() dto: AddContactsDto) {
    return this.service.addContacts(companyId, dto);
  }

  @Patch(':id/activate')
  activate(@Param('id') id: string, @CompanyId() companyId: string) {
    return this.service.activateCampaign(id, companyId);
  }

  @Patch(':id/pause')
  pause(@Param('id') id: string, @CompanyId() companyId: string) {
    return this.service.pauseCampaign(id, companyId);
  }

  @Patch(':id/archive')
  archive(@Param('id') id: string, @CompanyId() companyId: string) {
    return this.service.archiveCampaign(id, companyId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.service.updateCampaign(id, companyId, dto);
  }

  @Get(':id/sends')
  sends(@Param('id') id: string, @CompanyId() companyId: string) {
    return this.service.getCampaignSends(id, companyId);
  }
}
