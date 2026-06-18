import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/database/prisma.module';
import { WalletService } from './wallet.service';
import { RepasseCronService } from './repasse-cron.service';
import { WalletController } from './wallet.controller';

@Module({
  imports: [PrismaModule],
  providers: [WalletService, RepasseCronService],
  controllers: [WalletController],
  exports: [WalletService],
})
export class WalletModule {}
