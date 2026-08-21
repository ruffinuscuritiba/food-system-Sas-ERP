import { Module } from '@nestjs/common';
import { PrismaModule } from '@/database/prisma.module';
import { TrialMigrationService } from './trial-migration.service';

@Module({
  imports: [PrismaModule],
  providers: [TrialMigrationService],
})
export class TrialMigrationModule {}
