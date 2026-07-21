import { Module } from '@nestjs/common';
import { CouponsController } from './coupons.controller';
import { LoyaltyModule } from '@/modules/loyalty/loyalty.module';

@Module({
  imports: [LoyaltyModule],
  controllers: [CouponsController],
})
export class CouponsModule {}
