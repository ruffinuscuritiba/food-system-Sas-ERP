import { Module } from '@nestjs/common';
import { PrismaModule } from '@/database/prisma.module';
import { IaController } from './ia.controller';
import { IaService } from './ia.service';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [PrismaModule, ReportsModule],
  controllers: [IaController],
  providers: [IaService],
})
export class IaModule {}
