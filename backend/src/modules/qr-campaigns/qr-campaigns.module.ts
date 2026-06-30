import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule }       from '@/database/prisma.module';
import { QrCampaignsService } from './qr-campaigns.service';
import { QrCampaignsController, QrRedirectController } from './qr-campaigns.controller';

@Module({
  imports:     [PrismaModule, ConfigModule],
  controllers: [QrCampaignsController, QrRedirectController],
  providers:   [QrCampaignsService],
  exports:     [QrCampaignsService],
})
export class QrCampaignsModule {}
