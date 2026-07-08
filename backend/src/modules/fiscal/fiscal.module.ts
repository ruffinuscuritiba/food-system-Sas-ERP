import { Module } from '@nestjs/common';
import { PrismaModule } from '@/database/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { FiscalController } from './fiscal.controller';
import { FiscalService } from './fiscal.service';
import { FocusNfeProvider } from './providers/focus-nfe.provider';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [FiscalController],
  providers: [FiscalService, FocusNfeProvider],
  exports: [FiscalService],
})
export class FiscalModule {}
