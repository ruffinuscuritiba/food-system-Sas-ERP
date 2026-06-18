import { Module } from '@nestjs/common';
import { SmartImportController } from './smart-import.controller';
import { SmartImportService } from './smart-import.service';
import { PrismaModule } from 'src/database/prisma.module';
import { SubscriptionActiveGuard } from '@/common/guards/subscription-active.guard';

@Module({
  imports: [PrismaModule],
  controllers: [SmartImportController],
  providers: [SmartImportService, SubscriptionActiveGuard],
})
export class SmartImportModule {}
