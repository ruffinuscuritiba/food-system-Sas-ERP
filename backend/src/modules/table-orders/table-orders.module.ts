import { Module } from '@nestjs/common';

import { PrismaModule } from 'src/database/prisma.module';

import { TableOrdersController } from './table-orders.controller';

import { TableOrdersService } from './table-orders.service';

@Module({
  imports: [PrismaModule],

  controllers: [TableOrdersController],

  providers: [TableOrdersService],
})
export class TableOrdersModule {}