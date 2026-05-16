import {
  Body,
  Controller,
  Get,
  Post,
} from '@nestjs/common';

import { FinancialService } from './financial.service';

@Controller('financial')
export class FinancialController {

  constructor(
    private service: FinancialService,
  ) {}

  @Get()
  findAll() {

    return this.service.findAll();
  }

  @Get('summary')
  summary() {

    return this.service.summary();
  }

  @Post()
  create(@Body() body: any) {

    return this.service.create({
      ...body,

      companyId:
        '1f2254bd-3ed2-4ebb-9e93-43b046bb5d7a',
    });
  }
}