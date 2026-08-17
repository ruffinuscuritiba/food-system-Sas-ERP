import { Module } from '@nestjs/common';
import { PrismaModule } from '@/database/prisma.module';
import { CompanyModule } from '@/modules/company/company.module';
import { WhatsappAiModule } from '@/modules/whatsapp-ai/whatsapp-ai.module';
import { AbandonedCartController } from './abandoned-cart.controller';
import { AbandonedCartService } from './abandoned-cart.service';

@Module({
  imports: [PrismaModule, CompanyModule, WhatsappAiModule],
  controllers: [AbandonedCartController],
  providers: [AbandonedCartService],
  exports: [AbandonedCartService],
})
export class AbandonedCartModule {}
