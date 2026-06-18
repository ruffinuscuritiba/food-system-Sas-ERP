import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/database/prisma.module';
import { LayoutTemplatesService } from './layout-templates.service';
import { LayoutTemplatesController } from './layout-templates.controller';

@Module({
  imports: [PrismaModule],
  providers: [LayoutTemplatesService],
  controllers: [LayoutTemplatesController],
  exports: [LayoutTemplatesService],
})
export class LayoutTemplatesModule {}
