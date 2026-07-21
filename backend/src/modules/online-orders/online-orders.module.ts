import { Module } from '@nestjs/common';
import { PrismaModule } from '@/database/prisma.module';
import { SocketModule } from '@/socket/socket.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { DeliveryConfigModule } from '@/modules/delivery-config/delivery-config.module';
import { QrCampaignsModule } from '@/modules/qr-campaigns/qr-campaigns.module';
import { StockModule } from '@/modules/stock/stock.module';
import { OnlineOrdersService } from './online-orders.service';
import { OnlineOrdersController } from './online-orders.controller';

@Module({
  imports: [
    PrismaModule,
    SocketModule,
    NotificationsModule,
    DeliveryConfigModule,
    QrCampaignsModule,
    StockModule,
  ],
  controllers: [OnlineOrdersController],
  providers: [OnlineOrdersService],
  exports: [OnlineOrdersService],
})
export class OnlineOrdersModule {}
