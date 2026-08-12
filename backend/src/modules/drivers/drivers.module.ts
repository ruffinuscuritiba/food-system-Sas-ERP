import { Module } from '@nestjs/common';
import { DriversController } from './drivers.controller';
import { DriverInviteController } from './driver-invite.controller';
import { DriversService } from './drivers.service';
import { PrismaService } from '@/database/prisma.service';
import { OrdersModule } from '@/modules/orders/orders.module';
import { SocketModule } from '@/socket/socket.module';
import { ModuleGuard } from '@/common/guards/module.guard';
import { AuthModule } from '@/modules/auth/auth.module';
import { WhatsappAiModule } from '@/modules/whatsapp-ai/whatsapp-ai.module';

@Module({
  imports: [OrdersModule, SocketModule, AuthModule, WhatsappAiModule],
  controllers: [DriversController, DriverInviteController],
  providers: [DriversService, PrismaService, ModuleGuard],
  exports: [DriversService],
})
export class DriversModule {}
