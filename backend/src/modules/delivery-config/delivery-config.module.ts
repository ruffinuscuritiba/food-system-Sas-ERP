import { Module } from '@nestjs/common';
import { DeliveryConfigController } from './delivery-config.controller';
import { DeliveryConfigService } from './delivery-config.service';
import { PrismaService } from '@/database/prisma.service';

@Module({
  controllers: [DeliveryConfigController],
  providers: [DeliveryConfigService, PrismaService],
  exports: [DeliveryConfigService],
})
export class DeliveryConfigModule {}
