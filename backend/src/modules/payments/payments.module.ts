import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { PrismaModule } from '@/database/prisma.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
