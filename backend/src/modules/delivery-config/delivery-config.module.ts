import { Module } from '@nestjs/common';
import { DeliveryConfigController } from './delivery-config.controller';
import { DeliveryConfigService } from './delivery-config.service';
import { PrismaService } from '@/database/prisma.service';
import { ModuleGuard } from '@/common/guards/module.guard';

@Module({
  controllers: [DeliveryConfigController],
  providers: [DeliveryConfigService, PrismaService, ModuleGuard],
  exports: [DeliveryConfigService],
})
export class DeliveryConfigModule {}
