import { Module } from '@nestjs/common';
import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';
import { PrismaService } from '@/database/prisma.service';
import { OrdersModule } from '@/modules/orders/orders.module';
import { SocketModule } from '@/socket/socket.module';
import { ModuleGuard } from '@/common/guards/module.guard';

@Module({
  imports: [OrdersModule, SocketModule],
  controllers: [DriversController],
  providers: [DriversService, PrismaService, ModuleGuard],
  exports: [DriversService],
})
export class DriversModule {}
