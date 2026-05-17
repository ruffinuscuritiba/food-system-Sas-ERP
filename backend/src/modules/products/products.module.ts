import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { PrismaModule } from 'src/database/prisma.module';
import { AuditModule } from '@/modules/audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
