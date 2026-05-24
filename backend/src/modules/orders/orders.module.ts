import { Module } from '@nestjs/common';

import { OrdersController } from './orders.controller';

import { OrdersService } from './orders.service';

import { PrismaModule } from 'src/database/prisma.module';

import { StockModule } from '../stock/stock.module';

import { SocketModule } from '../../socket/socket.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';

@Module({

  imports: [
    PrismaModule,
    StockModule,
    SocketModule,
    LoyaltyModule,
  ],

  controllers: [OrdersController],

  providers: [OrdersService],
})
export class OrdersModule {}