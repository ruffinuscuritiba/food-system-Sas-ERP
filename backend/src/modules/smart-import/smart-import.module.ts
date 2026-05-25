import { Module } from '@nestjs/common';
import { SmartImportController } from './smart-import.controller';
import { SmartImportService } from './smart-import.service';
import { PrismaModule } from 'src/database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SmartImportController],
  providers: [SmartImportService],
})
export class SmartImportModule {}
