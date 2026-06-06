import { Module } from '@nestjs/common';
import { TrackingGateway } from './tracking.gateway';
import { AuthModule } from '@/modules/auth/auth.module';
import { OrdersModule } from '@/modules/orders/orders.module';

@Module({
  imports: [AuthModule, OrdersModule],
  providers: [TrackingGateway],
  exports: [TrackingGateway],
})
export class TrackingModule {}
