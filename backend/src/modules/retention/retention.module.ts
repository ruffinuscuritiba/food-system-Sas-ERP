import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@/database/prisma.module';
import { RetentionService } from './retention.service';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { LeadsModule } from '@/modules/leads/leads.module';
import { SuperAdminModule } from '@/modules/super-admin/super-admin.module';

@Module({
  imports: [PrismaModule, ConfigModule, NotificationsModule, LeadsModule, SuperAdminModule],
  providers: [RetentionService],
  exports: [RetentionService],
})
export class RetentionModule {}
