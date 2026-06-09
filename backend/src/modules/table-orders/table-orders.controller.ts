import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';

import { TableOrdersService } from './table-orders.service';

@Controller('table-orders')
export class TableOrdersController {
  constructor(private service: TableOrdersService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  create(@Body() body: any) {
    return this.service.create(body);
  }

  @Patch(':id/close')
  close(@Param('id') id: string) {
    return this.service.close(id);
  }
}
