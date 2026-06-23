import { Module } from '@nestjs/common';
import { PrismaModule } from '@/database/prisma.module';
import { VisitsService } from './visits.service';
import { VisitsController } from './visits.controller';

@Module({
  imports: [PrismaModule],
  providers: [VisitsService],
  controllers: [VisitsController],
})
export class VisitsModule {}
