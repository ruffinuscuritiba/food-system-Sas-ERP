import { Module } from '@nestjs/common';
import { ComplementsController } from './complements.controller';
import { ComplementsService } from './complements.service';
import { PrismaModule } from '@/database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ComplementsController],
  providers: [ComplementsService],
  exports: [ComplementsService],
})
export class ComplementsModule {}
