import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule }             from '@nestjs/config';
import { PrismaModule }             from '@/database/prisma.module';
import { OrdersModule }             from '@/modules/orders/orders.module';
import { WhatsappAiController }     from './whatsapp-ai.controller';
import { WhatsappAiService }        from './whatsapp-ai.service';
import { WhisperService }           from './services/whisper.service';
import { ClaudeCartService }        from './services/claude-cart.service';
import { OrderNotificationService } from './services/order-notification.service';
import { WaPaymentService }         from './services/wa-payment.service';

@Module({
  imports:     [PrismaModule, ConfigModule, forwardRef(() => OrdersModule)],
  controllers: [WhatsappAiController],
  providers:   [WhatsappAiService, WhisperService, ClaudeCartService, OrderNotificationService, WaPaymentService],
  exports:     [WhatsappAiService, OrderNotificationService],
})
export class WhatsappAiModule {}
