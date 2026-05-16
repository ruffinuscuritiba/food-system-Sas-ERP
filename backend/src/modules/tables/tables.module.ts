import { Module } from '@nestjs/common';

import { PrismaModule } from 'src/database/prisma.module';

import { TablesController } from './tables.controller';

import { TablesService } from './tables.service';

import { SocketModule } from '../../socket/socket.module';

@Module({


  imports: [
  PrismaModule,
  SocketModule,
],
  controllers: [TablesController],

  providers: [TablesService],
})

export class TablesModule {}