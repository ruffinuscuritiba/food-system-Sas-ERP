import { Module } from '@nestjs/common';
import { PrismaModule }             from '@/database/prisma.module';
import { WhatsappAiController }     from './whatsapp-ai.controller';
import { WhatsappAiService }        from './whatsapp-ai.service';
import { WhisperService }           from './services/whisper.service';
import { ClaudeCartService }        from './services/claude-cart.service';
import { OrderNotificationService } from './services/order-notification.service';

@Module({
  imports:     [PrismaModule],
  controllers: [WhatsappAiController],
  providers:   [WhatsappAiService, WhisperService, ClaudeCartService, OrderNotificationService],
  exports:     [WhatsappAiService, OrderNotificationService],
})
export class WhatsappAiModule {}
