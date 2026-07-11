import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CompanyId } from '@/common/decorators/company-id.decorator';
import { MarketingService } from './marketing.service';
import { GenerateCampaignDto } from './dto/generate-campaign.dto';

@Controller('marketing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
export class MarketingController {
  constructor(private readonly service: MarketingService) {}

  /**
   * GET /api/marketing/campaign/usage
   * Retorna quantas campanhas a empresa já gerou hoje (limite diário de 3).
   */
  @Get('campaign/usage')
  getUsage(@CompanyId() companyId: string) {
    return this.service.getUsage(companyId);
  }

  /**
   * POST /api/marketing/campaign/generate
   * Gera uma campanha de marketing via IA (Gemini) com base nos dados do formulário.
   * Sujeito ao limite diário de 3 campanhas por empresa.
   */
  @Post('campaign/generate')
  generate(@Body() dto: GenerateCampaignDto, @CompanyId() companyId: string) {
    return this.service.generateCampaign(dto, companyId);
  }
}
