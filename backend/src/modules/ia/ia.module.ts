import { Module } from '@nestjs/common';
import { PrismaModule } from '@/database/prisma.module';
import { IaController } from './ia.controller';
import { IaService } from './ia.service';
import { ReportsModule } from '../reports/reports.module';
import { SubscriptionActiveGuard } from '@/common/guards/subscription-active.guard';

@Module({
  imports: [PrismaModule, ReportsModule],
  controllers: [IaController],
  providers: [IaService, SubscriptionActiveGuard],
})
export class IaModule {}
