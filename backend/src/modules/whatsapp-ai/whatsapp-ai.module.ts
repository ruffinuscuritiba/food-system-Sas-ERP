import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@/database/prisma.module';
import { OrdersModule } from '@/modules/orders/orders.module';
import { ProductsModule } from '@/modules/products/products.module';
import { CategoriesModule } from '@/modules/categories/categories.module';
import { WhatsappAiController } from './whatsapp-ai.controller';
import { WhatsappAiService } from './whatsapp-ai.service';
import { WhisperService } from './services/whisper.service';
import { ClaudeCartService } from './services/claude-cart.service';
import { OrderNotificationService } from './services/order-notification.service';
import { WaPaymentService } from './services/wa-payment.service';
import { WhatsappAiPromptService } from './services/whatsapp-ai-prompt.service';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    forwardRef(() => OrdersModule),
    // ProductsService e CategoriesService são injetados na Kely para que
    // qualquer mudança de regra de negócio (soft-delete, sortOrder, isActive)
    // seja automaticamente refletida no cardápio que a IA usa.
    forwardRef(() => ProductsModule),
    forwardRef(() => CategoriesModule),
  ],
  controllers: [WhatsappAiController],
  providers: [
    WhatsappAiService,
    WhisperService,
    ClaudeCartService,
    OrderNotificationService,
    WaPaymentService,
    WhatsappAiPromptService,
  ],
  exports: [WhatsappAiService, OrderNotificationService],
})
export class WhatsappAiModule {}
