import { Module } from '@nestjs/common';
import { PizzaSizeConfigsController } from './pizza-size-configs.controller';
import { PizzaSizeConfigsService } from './pizza-size-configs.service';
import { PrismaModule } from '@/database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PizzaSizeConfigsController],
  providers: [PizzaSizeConfigsService],
  exports: [PizzaSizeConfigsService],
})
export class PizzaSizeConfigsModule {}
