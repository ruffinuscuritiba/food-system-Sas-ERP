import { Module } from '@nestjs/common';

import { PrismaModule } from 'src/database/prisma.module';

import { CompanyModuleController } from './company-module.controller';
import { CompanyModuleService } from './company-module.service';
import { ModuleGuard } from '@/common/guards/module.guard';

@Module({
  imports: [PrismaModule],
  controllers: [CompanyModuleController],
  providers: [CompanyModuleService, ModuleGuard],
  exports: [CompanyModuleService, ModuleGuard],
})
export class CompanyModuleModule {}
