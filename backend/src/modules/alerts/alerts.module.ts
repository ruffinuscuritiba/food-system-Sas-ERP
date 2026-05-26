import { Module } from '@nestjs/common';
import { PrismaModule } from '@/database/prisma.module';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { AlertsScheduler } from './alerts.scheduler';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [PrismaModule, ReportsModule],
  controllers: [AlertsController],
  providers: [AlertsService, AlertsScheduler],
})
export class AlertsModule {}
