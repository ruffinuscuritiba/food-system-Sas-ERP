import { Module } from '@nestjs/common';
import { PrismaModule } from '@/database/prisma.module';
import { SocketModule } from '@/socket/socket.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { OnlineOrdersService } from './online-orders.service';
import { OnlineOrdersController } from './online-orders.controller';

@Module({
  imports: [PrismaModule, SocketModule, NotificationsModule],
  controllers: [OnlineOrdersController],
  providers: [OnlineOrdersService],
  exports: [OnlineOrdersService],
})
export class OnlineOrdersModule {}
