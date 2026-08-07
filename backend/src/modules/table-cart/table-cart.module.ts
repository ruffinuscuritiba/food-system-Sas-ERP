import { Module } from '@nestjs/common';

import { PrismaService } from '@/database/prisma.service';
import { CompanyModule } from '@/modules/company/company.module';
import { SocketModule } from '@/socket/socket.module';
import { TableCartController } from './table-cart.controller';
import { TableCartService } from './table-cart.service';

@Module({
  imports: [CompanyModule, SocketModule],
  controllers: [TableCartController],
  providers: [TableCartService, PrismaService],
})
export class TableCartModule {}
