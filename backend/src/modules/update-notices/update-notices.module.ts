import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@/database/prisma.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { UpdateNoticesService } from './update-notices.service';
import { UpdateNoticesController } from './update-notices.controller';

@Module({
  imports: [PrismaModule, ConfigModule, NotificationsModule],
  controllers: [UpdateNoticesController],
  providers: [UpdateNoticesService],
  exports: [UpdateNoticesService],
})
export class UpdateNoticesModule {}
