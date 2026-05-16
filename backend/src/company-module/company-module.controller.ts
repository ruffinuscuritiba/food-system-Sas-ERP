import {
  Body,
  Controller,
  Get,
  Post,
} from '@nestjs/common';

import { CompanyModuleService } from './company-module.service';

@Controller('company-module')
export class CompanyModuleController {
  constructor(
    private service: CompanyModuleService,
  ) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  create(@Body() body: any) {
    return this.service.create(body);
  }
}