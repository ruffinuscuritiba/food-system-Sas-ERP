import { Module } from '@nestjs/common';

import { ThemesController } from './themes.controller';

import { ThemesService } from './themes.service';

import { PrismaModule } from '../../database/prisma.module';

@Module({
  imports: [PrismaModule],

  controllers: [ThemesController],

  providers: [ThemesService],
})
export class ThemesModule {}
