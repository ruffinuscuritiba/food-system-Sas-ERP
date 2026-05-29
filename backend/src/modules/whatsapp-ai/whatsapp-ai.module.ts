import { Module } from '@nestjs/common';
import { PrismaModule } from '@/database/prisma.module';
import { WhatsappAiController } from './whatsapp-ai.controller';
import { WhatsappAiService }    from './whatsapp-ai.service';

@Module({
  imports: [PrismaModule],
  controllers: [WhatsappAiController],
  providers: [WhatsappAiService],
  exports: [WhatsappAiService],
})
export class WhatsappAiModule {}
