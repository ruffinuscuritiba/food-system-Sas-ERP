import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard }   from '@/common/guards/roles.guard';
import { Roles }        from '@/common/decorators/roles.decorator';
import { MarketingService } from './marketing.service';
import { GenerateCampaignDto } from './dto/generate-campaign.dto';

@Controller('marketing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
export class MarketingController {
  constructor(private readonly service: MarketingService) {}

  /**
   * POST /api/marketing/campaign/generate
   * Gera uma campanha de marketing via IA (Gemini) com base nos dados do formulário.
   */
  @Post('campaign/generate')
  generate(@Body() dto: GenerateCampaignDto) {
    return this.service.generateCampaign(dto);
  }
}
