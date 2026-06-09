import { Body, Controller, Get, Param, Patch } from '@nestjs/common';

import { ThemesService } from './themes.service';

@Controller('themes')
export class ThemesController {
  constructor(private readonly themesService: ThemesService) {}

  @Get(':companyId')
  getTheme(
    @Param('companyId')
    companyId: string,
  ) {
    return this.themesService.getTheme(companyId);
  }

  @Patch(':companyId')
  updateTheme(
    @Param('companyId')
    companyId: string,

    @Body() body: any,
  ) {
    return this.themesService.updateTheme(companyId, body);
  }
}
