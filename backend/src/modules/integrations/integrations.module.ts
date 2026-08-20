import { Module } from '@nestjs/common';
import { PrismaModule } from '@/database/prisma.module';
import { OrdersModule } from '@/modules/orders/orders.module';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { IntegrationProviderFactory } from './providers/integration-provider.factory';
import { FiscalSplitModule } from '@/modules/fiscal-split/fiscal-split.module';

@Module({
  imports: [PrismaModule, OrdersModule, FiscalSplitModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, IntegrationProviderFactory],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
