import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { PrismaModule } from '@/database/prisma.module';
import { SocketModule } from '@/socket/socket.module';
import { OnlineOrdersModule } from '@/modules/online-orders/online-orders.module';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    SocketModule,
    OnlineOrdersModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
