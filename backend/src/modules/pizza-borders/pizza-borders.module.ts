import { Module } from '@nestjs/common';
import { PizzaBordersController } from './pizza-borders.controller';
import { PizzaBordersService } from './pizza-borders.service';
import { PrismaModule } from 'src/database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PizzaBordersController],
  providers: [PizzaBordersService],
  exports: [PizzaBordersService],
})
export class PizzaBordersModule {}
