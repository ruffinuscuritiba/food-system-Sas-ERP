import { Module } from '@nestjs/common';
import { PrismaModule } from '@/database/prisma.module';
import { WhatsappAiModule } from '@/modules/whatsapp-ai/whatsapp-ai.module';
import { WhatsappCampaignsController } from './whatsapp-campaigns.controller';
import { WhatsappCampaignsService } from './whatsapp-campaigns.service';

@Module({
  imports: [PrismaModule, WhatsappAiModule],
  controllers: [WhatsappCampaignsController],
  providers: [WhatsappCampaignsService],
  exports: [WhatsappCampaignsService],
})
export class WhatsappCampaignsModule {}
