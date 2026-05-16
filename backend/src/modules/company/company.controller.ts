import {
  Body,
  Controller,
  Get,
  Post,
} from '@nestjs/common';

import { CompanyService } from './company.service';

@Controller('company')
export class CompanyController {
  constructor(
    private service: CompanyService,
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