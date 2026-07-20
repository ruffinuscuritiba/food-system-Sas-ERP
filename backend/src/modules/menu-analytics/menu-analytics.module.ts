import { Module } from '@nestjs/common';

import { PrismaService } from '@/database/prisma.service';
import { CompanyModule } from '@/modules/company/company.module';
import { MenuAnalyticsController } from './menu-analytics.controller';
import { MenuAnalyticsService } from './menu-analytics.service';

@Module({
  imports: [CompanyModule],
  controllers: [MenuAnalyticsController],
  providers: [MenuAnalyticsService, PrismaService],
})
export class MenuAnalyticsModule {}
