import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@/database/prisma.module';
import { LoyaltyMilestonesService } from './loyalty-milestones.service';
import { LoyaltyMilestonesController } from './loyalty-milestones.controller';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [LoyaltyMilestonesController],
  providers: [LoyaltyMilestonesService],
  exports: [LoyaltyMilestonesService],
})
export class LoyaltyMilestonesModule {}
