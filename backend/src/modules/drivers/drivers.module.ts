import { Module } from '@nestjs/common';
import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';
import { PrismaService } from '@/database/prisma.service';
import { OrdersModule } from '@/modules/orders/orders.module';

@Module({
  imports: [OrdersModule],
  controllers: [DriversController],
  providers: [DriversService, PrismaService],
  exports: [DriversService],
})
export class DriversModule {}
