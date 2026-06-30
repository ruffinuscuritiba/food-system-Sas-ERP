import { Module, forwardRef } from '@nestjs/common';

import { OrdersController } from './orders.controller';

import { OrdersService } from './orders.service';

import { PrismaModule } from 'src/database/prisma.module';

import { StockModule } from '../stock/stock.module';

import { SocketModule } from '../../socket/socket.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { WhatsappAiModule } from '../whatsapp-ai/whatsapp-ai.module';
import { DeliveryConfigModule } from '../delivery-config/delivery-config.module';
import { QrCampaignsModule } from '../qr-campaigns/qr-campaigns.module';

@Module({
  imports: [
    PrismaModule,
    StockModule,
    SocketModule,
    LoyaltyModule,
    forwardRef(() => WhatsappAiModule),
    DeliveryConfigModule,
    QrCampaignsModule,
  ],

  controllers: [OrdersController],

  providers: [OrdersService],

  exports: [OrdersService],
})
export class OrdersModule {}
