import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() body: any) {
    return this.service.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @Patch(':id/block')
  block(@Param('id') id: string) {
    return this.service.blockCompany(id);
  }

  @Patch(':id/unblock')
  unblock(@Param('id') id: string) {
    return this.service.unblockCompany(id);
  }
}