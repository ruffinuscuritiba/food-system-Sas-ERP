import { Module } from '@nestjs/common';
import { PrismaModule } from '@/database/prisma.module';
import { SegmentSeedService } from './segment-seed.service';

@Module({
  imports: [PrismaModule],
  providers: [SegmentSeedService],
  exports: [SegmentSeedService],
})
export class SegmentSeedModule {}
