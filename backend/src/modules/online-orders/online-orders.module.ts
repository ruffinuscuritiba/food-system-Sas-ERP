import { Module } from '@nestjs/common';
import { PrismaModule } from '@/database/prisma.module';
import { SocketModule } from '@/socket/socket.module';
import { OnlineOrdersService } from './online-orders.service';
import { OnlineOrdersController } from './online-orders.controller';

@Module({
  imports: [PrismaModule, SocketModule],
  controllers: [OnlineOrdersController],
  providers: [OnlineOrdersService],
  exports: [OnlineOrdersService],
})
export class OnlineOrdersModule {}
