import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '@/database/prisma.module';
import { PaymentsModule } from '@/modules/payments/payments.module';
import { WhatsappAiModule } from '@/modules/whatsapp-ai/whatsapp-ai.module';
import { SalesPackagesService } from './sales-packages.service';
import { SalesPackagesController } from './sales-packages.controller';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => PaymentsModule),
    forwardRef(() => WhatsappAiModule),
  ],
  controllers: [SalesPackagesController],
  providers: [SalesPackagesService],
  exports: [SalesPackagesService],
})
export class SalesPackagesModule {}
