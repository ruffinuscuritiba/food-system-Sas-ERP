import { Module } from '@nestjs/common';
import { TrackingGateway } from './tracking.gateway';
import { PrismaService } from '@/database/prisma.service';

@Module({
  providers: [TrackingGateway, PrismaService],
  exports: [TrackingGateway],
})
export class TrackingModule {}
