import { Module } from '@nestjs/common';
import { PrintersService } from './printers.service';
import { PrintersController } from './printers.controller';
import { PrismaModule } from '@/database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PrintersController],
  providers: [PrintersService],
  exports: [PrintersService],
})
export class PrintersModule {}
