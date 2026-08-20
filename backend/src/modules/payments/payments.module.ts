import { forwardRef, Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { PrismaModule } from '@/database/prisma.module';
import { SocketModule } from '@/socket/socket.module';
import { OnlineOrdersModule } from '@/modules/online-orders/online-orders.module';
import { WalletModule } from '@/modules/wallet/wallet.module';
import { FiscalSplitModule } from '@/modules/fiscal-split/fiscal-split.module';
import { SalesPackagesModule } from '@/modules/sales-packages/sales-packages.module';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    SocketModule,
    OnlineOrdersModule,
    WalletModule,
    FiscalSplitModule,
    forwardRef(() => SalesPackagesModule),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
