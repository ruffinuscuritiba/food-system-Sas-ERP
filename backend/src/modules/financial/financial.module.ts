import { Module } from '@nestjs/common';

import { PrismaModule } from 'src/database/prisma.module';

import { FinancialController } from './financial.controller';

import { FinancialService } from './financial.service';

@Module({
  imports: [PrismaModule],

  controllers: [FinancialController],

  providers: [FinancialService],
})
export class FinancialModule {}